"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectedNodes = exports.io = exports.telemetryEvents = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const Dispatcher_1 = require("../queue/Dispatcher");
const AgentQueue_1 = require("../queue/AgentQueue");
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const Signer_1 = require("../crypto/Signer");
const events_1 = require("events");
const PerceptionEngine_1 = require("../ai/PerceptionEngine");
const zlib_1 = __importDefault(require("zlib"));
exports.telemetryEvents = new events_1.EventEmitter();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Configure Socket.IO
exports.io = new socket_io_1.Server(server, {
    cors: { origin: '*' } // Allow edge nodes to connect
});
// Map to track connected nodes: Map<node_id, socket_id>
exports.connectedNodes = new Map();
app.use(express_1.default.json());
const prisma = new client_1.PrismaClient();
// WebSocket Connection Handler
exports.io.on('connection', (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);
    // When a node authenticates/registers
    socket.on('register_node', async (data) => {
        const { node_id } = data;
        if (node_id) {
            exports.connectedNodes.set(node_id, socket.id);
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
            exports.telemetryEvents.emit(`telemetry_${job_id}`, data);
        }
    });
    socket.on('disconnect', () => {
        // Find and remove the node from connectedNodes
        for (const [nodeId, socketId] of exports.connectedNodes.entries()) {
            if (socketId === socket.id) {
                exports.connectedNodes.delete(nodeId);
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
    const jobId = (0, uuid_1.v4)();
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
    await Dispatcher_1.jobQueue.add('dispatch-job', {
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
        const dumpJobId = (0, uuid_1.v4)();
        await prisma.job.create({
            data: {
                id: dumpJobId,
                nodeId: node_id,
                action: 'dump_ui',
                payload: {},
                status: 'PENDING'
            }
        });
        await Dispatcher_1.jobQueue.add('dispatch-job', {
            node_id, action: 'dump_ui', params: {}
        }, { jobId: dumpJobId });
        // Wait for the telemetry report for this job
        const telemetryData = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("Timeout waiting for UI dump")), 15000);
            exports.telemetryEvents.once(`telemetry_${dumpJobId}`, (data) => {
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
            const xmlBuffer = zlib_1.default.gunzipSync(Buffer.from(cleanUiDump, 'base64'));
            xmlDump = xmlBuffer.toString('utf-8');
        }
        catch (gzErr) {
            console.warn("Failed to gunzip XML, falling back to raw decode", gzErr);
            xmlDump = Buffer.from(cleanUiDump, 'base64').toString('utf-8');
        }
        let imageBase64;
        if (telemetryData.screenshot) {
            try {
                const imgBuffer = zlib_1.default.gunzipSync(Buffer.from(telemetryData.screenshot, 'base64'));
                imageBase64 = imgBuffer.toString('base64');
            }
            catch (gzErr) {
                console.warn("Failed to gunzip Screenshot, using raw base64");
                imageBase64 = telemetryData.screenshot; // Assuming it is just raw base64 encoded image
            }
        }
        // 3. Pass to Perception Engine
        const target = await PerceptionEngine_1.perceptionEngine.resolveTarget(goal, xmlDump, imageBase64);
        // 4. Dispatch the physical click job
        const clickJobId = (0, uuid_1.v4)();
        await prisma.job.create({
            data: {
                id: clickJobId,
                nodeId: node_id,
                action: 'shell',
                payload: { command: `input tap ${target.x} ${target.y}` },
                status: 'PENDING'
            }
        });
        await Dispatcher_1.jobQueue.add('dispatch-job', {
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
    }
    catch (error) {
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
    const sessionId = (0, uuid_1.v4)();
    // Enqueue Job in BullMQ
    await AgentQueue_1.agentQueue.add('start-autonomous-session', {
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
    const job = await AgentQueue_1.agentQueue.getJob(jobId);
    if (!job) {
        return res.status(404).json({ error: 'Session not found' });
    }
    const state = await job.getState();
    let result = null;
    let failedReason = null;
    if (state === 'completed') {
        result = job.returnvalue;
    }
    else if (state === 'failed') {
        failedReason = job.failedReason;
    }
    return res.json({
        session_id: jobId,
        state: state, // 'waiting', 'active', 'completed', 'failed'
        result: result,
        error: failedReason
    });
});
app.get('/api/v1/public-key', (req, res) => {
    res.json({ public_key: Signer_1.signer.getPublicKeyHex() });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Cloud Orchestrator WebSockets & API listening on port ${PORT}`);
});
//# sourceMappingURL=Server.js.map