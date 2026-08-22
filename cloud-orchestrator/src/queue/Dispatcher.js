"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worker = exports.jobQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const Signer_1 = require("../crypto/Signer");
const client_1 = require("@prisma/client");
const Server_1 = require("../api/Server");
const FirebaseAdmin_1 = require("../fcm/FirebaseAdmin");
const connection = new ioredis_1.default({ maxRetriesPerRequest: null });
const prisma = new client_1.PrismaClient();
// The Job Queue
exports.jobQueue = new bullmq_1.Queue('node-jobs', { connection });
// The Worker (Dispatcher)
exports.worker = new bullmq_1.Worker('node-jobs', async (job) => {
    const { node_id, action, params } = job.data;
    console.log(`[Dispatcher] Processing job ${job.id} for node ${node_id}`);
    // Check if node is connected
    const socketId = Server_1.connectedNodes.get(node_id);
    // 1. Sign the payload
    const signedPayload = Signer_1.signer.signPayload({
        job_id: job.id,
        node_id,
        action,
        params
    });
    try {
        // Update DB status to DISPATCHED
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'DISPATCHED' }
        });
        // 2. Dispatch via WebSocket or FCM
        if (socketId) {
            Server_1.io.to(socketId).emit('dispatch_job', signedPayload);
            console.log(`[Dispatcher] Successfully emitted job ${job.id} to socket ${socketId}`);
        }
        else {
            const node = await prisma.node.findUnique({ where: { id: node_id } });
            if (!node || !node.fcmToken) {
                throw new Error(`Node ${node_id} is not connected to WebSockets and has no FCM token registered.`);
            }
            await FirebaseAdmin_1.messaging.send({
                token: node.fcmToken,
                data: {
                    payload: JSON.stringify(signedPayload)
                },
                android: {
                    priority: 'high'
                }
            });
            console.log(`[Dispatcher] Successfully emitted job ${job.id} via FCM High-Priority Data Message to ${node_id}`);
        }
        // We do NOT mark SUCCESS here anymore. We wait for the Android node 
        // to execute the shell command and emit the 'telemetry_report' event!
    }
    catch (error) {
        console.error(`[Dispatcher] Error dispatching job ${job.id}:`, error.message);
        // Update DB status to FAILED
        await prisma.job.update({
            where: { id: job.id },
            data: { status: 'FAILED', errorReason: error.message }
        });
        throw error; // Let BullMQ handle retries
    }
}, {
    connection,
    // Limit to 1 concurrent job per Node (using node_id as the lock key)
    concurrency: 10,
    limiter: {
        max: 1,
        duration: 1000,
        groupKey: 'node_id' // This ensures a specific node only gets 1 job at a time!
    }
});
//# sourceMappingURL=Dispatcher.js.map