"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentWorker = exports.agentQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const AutonomousAgent_1 = require("../ai/AutonomousAgent");
const connection = new ioredis_1.default({ maxRetriesPerRequest: null });
// The Autonomous Agent Queue
exports.agentQueue = new bullmq_1.Queue('autonomous-jobs', { connection });
// The Worker
exports.agentWorker = new bullmq_1.Worker('autonomous-jobs', async (job) => {
    const { node_id, goal, max_steps } = job.data;
    console.log(`[AgentWorker] Starting autonomous session ${job.id} for node ${node_id}`);
    const agent = new AutonomousAgent_1.AutonomousAgent(node_id, goal, max_steps);
    try {
        const result = await agent.run();
        console.log(`[AgentWorker] Session ${job.id} completed with status: ${result.status}`);
        return result;
    }
    catch (error) {
        console.error(`[AgentWorker] Error in session ${job.id}:`, error.message);
        throw error;
    }
}, {
    connection,
    concurrency: 10 // We can run 10 autonomous agents in parallel
});
//# sourceMappingURL=AgentQueue.js.map