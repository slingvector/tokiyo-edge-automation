import './api/Server';
import { worker } from './queue/Dispatcher';

console.log("Cloud Orchestrator booting up...");

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`[Worker] Job ${job?.id} has failed with ${err.message}`);
});

import { agentWorker } from './queue/AgentQueue';

agentWorker.on('completed', (job) => {
  console.log(`[AgentWorker] Autonomous Session ${job.id} completed!`);
});

agentWorker.on('failed', (job, err) => {
  console.log(`[AgentWorker] Autonomous Session ${job?.id} failed with ${err.message}`);
});

import { linkedinWorker } from './queue/LinkedInQueue';

linkedinWorker.on('completed', (job) => {
  console.log(`[LinkedInWorker] LinkedIn Job ${job.id} completed!`);
});

linkedinWorker.on('failed', (job, err) => {
  console.log(`[LinkedInWorker] LinkedIn Job ${job?.id} failed with ${err.message}`);
});

import { compiledWorker } from './queue/CompiledScriptDispatcher';

compiledWorker.on('completed', (job) => {
  console.log(`[CompiledWorker] Job ${job.id} dispatched!`);
});

compiledWorker.on('failed', (job, err) => {
  console.log(`[CompiledWorker] Job ${job?.id} failed with ${err.message}`);
});

compiledWorker.on('error', (err) => {
  console.error('[CompiledWorker] Worker error:', err);
});
