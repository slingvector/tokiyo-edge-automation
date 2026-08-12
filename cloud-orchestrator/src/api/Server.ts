import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { jobQueue } from '../queue/Dispatcher';
import { agentQueue } from '../queue/AgentQueue';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { signer } from '../crypto/Signer';
import { EventEmitter } from 'events';
import { perceptionEngine } from '../ai/PerceptionEngine';
import zlib from 'zlib';

export const telemetryEvents = new EventEmitter();

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
export const io = new SocketIOServer(server, {
  cors: { origin: '*' } // Allow edge nodes to connect
});

// Map to track connected nodes: Map<node_id, socket_id>
export const connectedNodes = new Map<string, string>();

app.use(express.json());
const prisma = new PrismaClient();

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // When a node authenticates/registers
  socket.on('register_node', async (data) => {
    const { node_id } = data;
    if (node_id) {
      connectedNodes.set(node_id, socket.id);
      console.log(`[Socket] Node ${node_id} registered with socket ${socket.id}`);
      
      // Ensure node exists in DB and is marked ACTIVE
      await prisma.node.upsert({
        where: { id: node_id },
        update: { status: 'ACTIVE' },
        create: { id: node_id, status: 'ACTIVE' }
      });
      
      socket.emit('registered', { status: 'SUCCESS' });
    }
  });

  // When a node sends telemetry / job results back
  socket.on('telemetry_report', async (data) => {
    console.log(`[Telemetry] Received from ${socket.id}:`, data.job_id, data.status);
    const { job_id, node_id, status, exit_code, stdout, stderr, ui_dump, screenshot } = data;

    if (job_id) {
      // Optional: Save ui_dump and screenshot to disk for debugging
      if (ui_dump || screenshot) {
          const fs = require('fs');
          const path = require('path');
          const snapshotsDir = path.join(__dirname, '../../snapshots');
          if (!fs.existsSync(snapshotsDir)) {
              fs.mkdirSync(snapshotsDir, { recursive: true });
          }
          if (ui_dump) {
              fs.writeFileSync(path.join(snapshotsDir, `${job_id}.xml.gz`), Buffer.from(ui_dump, 'base64'));
          }
          if (screenshot) {
              fs.writeFileSync(path.join(snapshotsDir, `${job_id}.png.gz`), Buffer.from(screenshot, 'base64'));
          }
      }

      await prisma.job.update({
        where: { id: job_id },
        data: { 
          status: status, // 'SUCCESS' or 'FAILED'
          errorReason: stderr ? stderr.substring(0, 255) : null,
          payload: { stdout, stderr, exit_code } // Storing result in payload JSON
        }
      });
      
      telemetryEvents.emit(`telemetry_${job_id}`, data);
    }
  });

  socket.on('disconnect', () => {
    // Find and remove the node from connectedNodes
    for (const [nodeId, socketId] of connectedNodes.entries()) {
      if (socketId === socket.id) {
        connectedNodes.delete(nodeId);
        console.log(`[Socket] Node ${nodeId} disconnected`);
        // Optionally mark node as offline in DB here
        break;
      }
    }
  });
});

// REST API for external job ingestion
app.post('/api/v1/jobs', async (req, res) => {
  const { node_id, action, params } = req.body;

  if (!node_id || !action) {
    return res.status(400).json({ error: 'node_id and action are required' });
  }

  const jobId = uuidv4();

  // 1. Ensure node exists in DB
  await prisma.node.upsert({
    where: { id: node_id },
    update: {},
    create: { id: node_id }
  });

  // 2. Insert Job into DB
  await prisma.job.create({
    data: {
      id: jobId,
      nodeId: node_id,
      action: action,
      payload: params || {},
      status: 'PENDING'
    }
  });

  // 3. Enqueue Job in BullMQ
  await jobQueue.add('dispatch-job', {
    node_id,
    action,
    params
  }, {
    jobId: jobId
  });

  return res.status(201).json({ status: 'ENQUEUED', job_id: jobId });
});

// AI Perception Endpoint
app.post('/api/v1/agent/action', async (req, res) => {
  const { node_id, goal } = req.body;

  if (!node_id || !goal) {
    return res.status(400).json({ error: 'node_id and goal are required' });
  }

  try {
    // 1. Dispatch a dump_ui job
    const dumpJobId = uuidv4();
    await prisma.job.create({
      data: {
        id: dumpJobId,
        nodeId: node_id,
        action: 'dump_ui',
        payload: {},
        status: 'PENDING'
      }
    });
    await jobQueue.add('dispatch-job', {
      node_id, action: 'dump_ui', params: {}
    }, { jobId: dumpJobId });

    // Wait for the telemetry report for this job
    const telemetryData: any = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for UI dump")), 15000);
      telemetryEvents.once(`telemetry_${dumpJobId}`, (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    if (!telemetryData.ui_dump) {
      return res.status(500).json({ error: 'Failed to retrieve UI dump from edge node' });
    }

    // 2. Decompress XML and Image
    const cleanUiDump = telemetryData.ui_dump.replace("UI hierchary dumped to: /data/local/tmp/dump.xml", "").trim();
    
    let xmlDump;
    try {
        const xmlBuffer = zlib.gunzipSync(Buffer.from(cleanUiDump, 'base64'));
        xmlDump = xmlBuffer.toString('utf-8');
    } catch (gzErr) {
        console.warn("Failed to gunzip XML, falling back to raw decode", gzErr);
        xmlDump = Buffer.from(cleanUiDump, 'base64').toString('utf-8');
    }
    
    let imageBase64;
    if (telemetryData.screenshot) {
       try {
           const imgBuffer = zlib.gunzipSync(Buffer.from(telemetryData.screenshot, 'base64'));
           imageBase64 = imgBuffer.toString('base64');
       } catch (gzErr) {
           console.warn("Failed to gunzip Screenshot, using raw base64");
           imageBase64 = telemetryData.screenshot; // Assuming it is just raw base64 encoded image
       }
    }

    // 3. Pass to Perception Engine
    const target = await perceptionEngine.resolveTarget(goal, xmlDump, imageBase64);

    // 4. Dispatch the physical click job
    const clickJobId = uuidv4();
    await prisma.job.create({
      data: {
        id: clickJobId,
        nodeId: node_id,
        action: 'shell',
        payload: { command: `input tap ${target.x} ${target.y}` },
        status: 'PENDING'
      }
    });
    await jobQueue.add('dispatch-job', {
      node_id, 
      action: 'shell',
      params: { 
         command: `input tap ${target.x} ${target.y}` 
      }
    }, { jobId: clickJobId });

    return res.json({ 
       status: 'SUCCESS',
       perception: target,
       action_job_id: clickJobId
    });

  } catch (error: any) {
    console.error("Agent Action Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// AI Autonomous Session Endpoint
app.post('/api/v1/agent/autonomous', async (req, res) => {
  const { node_id, goal, max_steps = 10 } = req.body;

  if (!node_id || !goal) {
    return res.status(400).json({ error: 'node_id and goal are required' });
  }

  const sessionId = uuidv4();

  // Enqueue Job in BullMQ
  await agentQueue.add('start-autonomous-session', {
    node_id,
    goal,
    max_steps
  }, {
    jobId: sessionId
  });

  return res.status(201).json({ status: 'STARTED', session_id: sessionId });
});

app.get('/api/v1/public-key', (req, res) => {
  res.json({ public_key: signer.getPublicKeyHex() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Cloud Orchestrator WebSockets & API listening on port ${PORT}`);
});
