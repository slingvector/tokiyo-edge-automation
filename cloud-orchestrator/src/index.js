"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./api/Server");
const Dispatcher_1 = require("./queue/Dispatcher");
console.log("Cloud Orchestrator booting up...");
Dispatcher_1.worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} has completed!`);
});
Dispatcher_1.worker.on('failed', (job, err) => {
    console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});
const AgentQueue_1 = require("./queue/AgentQueue");
AgentQueue_1.agentWorker.on('completed', (job) => {
    console.log(`[AgentWorker] Autonomous Session ${job.id} completed!`);
});
AgentQueue_1.agentWorker.on('failed', (job, err) => {
    console.log(`[AgentWorker] Autonomous Session ${job?.id} failed with ${err.message}`);
});
//# sourceMappingURL=index.js.map