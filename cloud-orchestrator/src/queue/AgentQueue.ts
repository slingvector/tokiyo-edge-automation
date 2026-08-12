import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { AutonomousAgent } from '../ai/AutonomousAgent';

const connection = new IORedis({ maxRetriesPerRequest: null });

// The Autonomous Agent Queue
export const agentQueue = new Queue('autonomous-jobs', { connection });

// The Worker
export const agentWorker = new Worker('autonomous-jobs', async (job: Job) => {
  const { node_id, goal, max_steps } = job.data;
  
  console.log(`[AgentWorker] Starting autonomous session ${job.id} for node ${node_id}`);

  const agent = new AutonomousAgent(node_id, goal, max_steps);
  
  try {
    const result = await agent.run();
    console.log(`[AgentWorker] Session ${job.id} completed with status: ${result.status}`);
    return result;
  } catch (error: any) {
    console.error(`[AgentWorker] Error in session ${job.id}:`, error.message);
    throw error;
  }

}, { 
  connection,
  concurrency: 10 // We can run 10 autonomous agents in parallel
});
