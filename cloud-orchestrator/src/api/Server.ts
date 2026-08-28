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
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export const telemetryEvents = new EventEmitter();

const app = express();
export const server = http.createServer(app);

// Configure Socket.IO
export const io = new SocketIOServer(server, {
  cors: { origin: '*' }, // Allow edge nodes to connect
  maxHttpBufferSize: 5e7 // 50MB
});

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redisClient = new Redis(redisUrl);
const subClient = redisClient.duplicate();
io.adapter(createAdapter(redisClient, subClient));

// Note: Map variables are deprecated in favor of redisClient.hget/hset
// We leave them exported but empty so imports don't break immediately if not updated.
export const connectedNodes = new Map<string, string>();
export const nodeStatus = new Map<string, 'IDLE' | 'BUSY'>();

app.use(express.json());
const prisma = new PrismaClient();

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log(`[Socket] New connection: ${socket.id}`);

  // When a node authenticates/registers
  socket.on('register_node', async (data) => {
    const { node_id } = data;
    if (node_id) {
      (socket as any).node_id = node_id;
      await redisClient.hset('connectedNodes', node_id, socket.id);
      
      const currentStatus = await redisClient.hget('nodeStatus', node_id);
      if (!currentStatus) {
        await redisClient.hset('nodeStatus', node_id, 'IDLE');
      }
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

  socket.on('disconnect', async () => {
    const nodeId = (socket as any).node_id;
    if (nodeId) {
      await redisClient.hdel('connectedNodes', nodeId);
      await redisClient.hdel('nodeStatus', nodeId);
      console.log(`[Socket] Node ${nodeId} disconnected`);
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
  let { node_id, goal, max_steps = 10 } = req.body;

  if (!goal) {
    return res.status(400).json({ error: 'goal is required' });
  }

  if (!node_id) {
    const { FleetRouter } = require('../queue/FleetRouter');
    node_id = await FleetRouter.assignIdleNode();
    if (!node_id) {
      return res.status(503).json({ error: 'No idle devices available in the fleet' });
    }
  } else {
    // If a specific node was requested, check if it's BUSY
    const status = await redisClient.hget('nodeStatus', node_id);
    if (status === 'BUSY') {
        return res.status(409).json({ error: `Node ${node_id} is currently busy`});
    }
    await redisClient.hset('nodeStatus', node_id, 'BUSY');
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

app.get('/api/v1/agent/autonomous/:id', async (req, res) => {
  const jobId = req.params.id;
  const job = await agentQueue.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const state = await job.getState();
  let result = null;
  let failedReason = null;
  
  if (state === 'completed') {
    result = job.returnvalue;
  } else if (state === 'failed') {
    failedReason = job.failedReason;
  }
  
  return res.json({
    session_id: jobId,
    state: state, // 'waiting', 'active', 'completed', 'failed'
    result: result,
    error: failedReason
  });
});

import { linkedinQueue } from '../queue/LinkedInQueue';
import { instagramQueue } from '../queue/InstagramQueue';

// LinkedIn Automation Endpoint
app.post('/api/v1/engage/linkedin', async (req, res) => {
  const { node_id, type, target_id, message } = req.body;

  if (!node_id || !type || !target_id || !message) {
    return res.status(400).json({ error: 'node_id, type, target_id, and message are required' });
  }

  // Ensure node is connected
  const status = await redisClient.hget('nodeStatus', node_id);
  if (!status) {
    return res.status(404).json({ error: 'Node not found or not connected' });
  }

  const jobId = uuidv4();

  // Enqueue Job in BullMQ
  await linkedinQueue.add('engage-linkedin', {
    node_id,
    type,
    target_id,
    message
  }, {
    jobId: jobId,
    attempts: 10,
    backoff: {
      type: 'exponential',
      delay: 15000
    }
  });

  return res.status(201).json({ status: 'ENQUEUED', job_id: jobId });
});

// Instagram Automation Endpoint
app.post('/api/v1/engage/instagram', async (req, res) => {
  const { node_id, type, target_id, message, shouldFollow, shouldSave } = req.body;

  if (!node_id || !type || !target_id) {
    return res.status(400).json({ error: 'node_id, type, and target_id are required' });
  }

  // For 'post' and 'comment' types, message is required
  if ((type === 'post' || type === 'comment') && !message) {
    return res.status(400).json({ error: 'message is required for post and comment types' });
  }

  // Ensure node is connected
  const status = await redisClient.hget('nodeStatus', node_id);
  if (!status) {
    return res.status(404).json({ error: 'Node not found or not connected' });
  }

  const jobId = uuidv4();

  // Enqueue Job in BullMQ
  await instagramQueue.add('engage-instagram', {
    node_id,
    type,      // 'post' | 'like' | 'comment' | 'follow' | 'save'
    target_id, // Instagram URL (post, reel, or profile)
    message,   // Comment text (required for post/comment, optional for like/follow/save)
    shouldFollow, // Optional: follow the user
    shouldSave    // Optional: save the post
  }, {
    jobId: jobId,
    attempts: 10,
    backoff: {
      type: 'exponential',
      delay: 15000
    }
  });

  return res.status(201).json({ status: 'ENQUEUED', job_id: jobId });
});

// Instagram Post Discovery + Bulk Enqueue Endpoint
app.post('/api/v1/engage/instagram/discover', async (req, res) => {
  const { node_ids, topics, hashtags, manual_urls, use_explore, max_posts, auto_enqueue, comment_template, shouldFollow, shouldSave } = req.body;

  if (!node_ids || !Array.isArray(node_ids) || node_ids.length === 0) {
    return res.status(400).json({ error: 'node_ids array is required' });
  }

  try {
    const { discoverInstagramPosts, TOPIC_HASHTAGS } = require('../services/InstagramDiscovery');

    // Build hashtag list from topics + explicit hashtags
    const resolvedHashtags: string[] = [
      ...(hashtags || []),
      ...((topics || []) as string[]).flatMap((t: string) => TOPIC_HASHTAGS[t] || []),
    ];

    const posts = await discoverInstagramPosts({
      manualUrls: manual_urls || [],
      hashtags: resolvedHashtags,
      useExplore: use_explore || false,
      maxPosts: max_posts || 30,
      verify: true,
    });

    if (!auto_enqueue || posts.length === 0) {
      return res.json({ status: 'DISCOVERED', count: posts.length, posts });
    }

    // Round-robin distribute posts across node_ids
    const enqueuedJobs: string[] = [];
    const comment = comment_template || 'Great post! Really insightful perspective.';

    for (let i = 0; i < posts.length; i++) {
      const node_id = node_ids[i % node_ids.length];
      const post = posts[i]!;
      const jobId = uuidv4();

      await instagramQueue.add('engage-instagram', {
        node_id,
        type: 'post',
        target_id: post.url,
        message: comment,
        shouldFollow: shouldFollow || false,
        shouldSave: shouldSave || false,
      }, {
        jobId,
        attempts: 10,
        backoff: { type: 'exponential', delay: 15000 },
      });

      enqueuedJobs.push(jobId);
      console.log(`[Discovery] Enqueued job ${jobId} → node ${node_id} → ${post.url}`);
    }

    return res.status(201).json({
      status: 'ENQUEUED',
      discovered: posts.length,
      enqueued: enqueuedJobs.length,
      job_ids: enqueuedJobs,
      posts,
    });

  } catch (error: any) {
    console.error('[Discovery] Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Static APK Analysis Proxy Endpoint
app.post('/api/v1/analyzer/deep-links', async (req, res) => {
  const { apk_path } = req.body;
  if (!apk_path) {
    return res.status(400).json({ error: 'apk_path is required' });
  }

  try {
    const response = await fetch('http://127.0.0.1:8082/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apk_path })
    });
    
    if (!response.ok) {
      throw new Error(`Analyzer returned status ${response.status}`);
    }
    
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("APK Analyzer Error:", error);
    return res.status(500).json({ error: 'Failed to communicate with APK analyzer: ' + error.message });
  }
});

// Hardware & Scale Resiliency Endpoint
app.post('/api/v1/agent/resiliency', async (req, res) => {
  const { node_id, package_name } = req.body;
  if (!node_id || !package_name) {
    return res.status(400).json({ error: 'node_id and package_name are required' });
  }

  try {
    // Dispatch pm clear
    const clearJobId = uuidv4();
    await prisma.job.create({
      data: {
        id: clearJobId,
        nodeId: node_id,
        action: 'shell',
        payload: { command: `pm clear ${package_name}` },
        status: 'PENDING'
      }
    });
    await jobQueue.add('dispatch-job', {
      node_id, action: 'shell', params: { command: `pm clear ${package_name}` }
    }, { jobId: clearJobId });

    // Dispatch dumpsys deviceidle for target package
    const whitelistJobId1 = uuidv4();
    await prisma.job.create({
      data: {
        id: whitelistJobId1,
        nodeId: node_id,
        action: 'shell',
        payload: { command: `dumpsys deviceidle whitelist +${package_name}` },
        status: 'PENDING'
      }
    });
    await jobQueue.add('dispatch-job', {
      node_id, action: 'shell', params: { command: `dumpsys deviceidle whitelist +${package_name}` }
    }, { jobId: whitelistJobId1 });

    // Dispatch dumpsys deviceidle for agent package
    const whitelistJobId2 = uuidv4();
    await prisma.job.create({
      data: {
        id: whitelistJobId2,
        nodeId: node_id,
        action: 'shell',
        payload: { command: `dumpsys deviceidle whitelist +com.tokiyo.shizukuspike` },
        status: 'PENDING'
      }
    });
    await jobQueue.add('dispatch-job', {
      node_id, action: 'shell', params: { command: `dumpsys deviceidle whitelist +com.tokiyo.shizukuspike` }
    }, { jobId: whitelistJobId2 });

    return res.status(201).json({ 
      status: 'ENQUEUED', 
      jobs: [clearJobId, whitelistJobId1, whitelistJobId2]
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/public-key', (req, res) => {
  res.json({ public_key: signer.getPublicKeyHex() });
});

// Fleet Status Endpoint
app.get('/api/v1/fleet/status', async (req, res) => {
  const statuses = await redisClient.hgetall('nodeStatus');
  const sockets = await redisClient.hgetall('connectedNodes');
  const fleet = Object.keys(statuses).map(node_id => {
    return {
      node_id,
      status: statuses[node_id],
      socket_id: sockets[node_id]
    };
  });
  res.json({ fleet });
});

const PORT = process.env.PORT || 3000;
if (require.main === module || process.env.NODE_ENV === 'production' || process.env.START_SERVER === 'true') {
  server.listen(PORT, () => {
    console.log(`Cloud Orchestrator WebSockets & API listening on port ${PORT}`);
  });
}
