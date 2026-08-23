import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { LinkedInEngager } from '../services/LinkedInEngager';
import { RemoteShizukuController } from '../utils/RemoteShizukuController';
import { redisClient } from '../api/Server';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const linkedinQueue = new Queue('linkedin-jobs', { connection });

export const linkedinWorker = new Worker('linkedin-jobs', async (job: Job) => {
  const { node_id, type, target_id, message } = job.data;
  
  console.log(`[LinkedInWorker] Starting ${type} job for node ${node_id} to target ${target_id}`);

  // We must ensure the node is actually connected before running!
  const socketId = await redisClient.hget('connectedNodes', node_id);
  if (!socketId) {
    throw new Error(`Node ${node_id} is not currently connected to the cloud!`);
  }

  const controller = new RemoteShizukuController(node_id);
  const engager = new LinkedInEngager(node_id, controller);
  
  try {
    if (type === 'thread') {
      await engager.sendDirectMessage(target_id, message);
    } else if (type === 'profile') {
      await engager.messageProfile(target_id, message);
    } else if (type === 'post') {
      await engager.engagePost(target_id, message);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
    console.log(`[LinkedInWorker] Job ${job.id} completed successfully`);
  } catch (error: any) {
    console.error(`[LinkedInWorker] Error in job ${job.id}:`, error.message);
    throw error;
  }
}, { 
  connection,
  concurrency: 5 
});
