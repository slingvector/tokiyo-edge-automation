import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { InstagramEngager } from '../services/InstagramEngager';
import { RemoteShizukuController } from '../utils/RemoteShizukuController';
import { redisClient } from '../api/Server';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const instagramQueue = new Queue('instagram-jobs', { connection });

export const instagramWorker = new Worker('instagram-jobs', async (job: Job) => {
  const { node_id, type, target_id, message, shouldFollow, shouldSave } = job.data;
  
  console.log(`[InstagramWorker] Starting ${type} job for node ${node_id} to target ${target_id}`);

  // Pre-flight link verification
  try {
    const response = await fetch(target_id, { method: 'HEAD' });
    if (response.status === 404) {
      console.warn(`[InstagramWorker] Skipping job ${job.id}: URL returned 404 Not Found -> ${target_id}`);
      return;
    }
  } catch (err: any) {
    console.warn(`[InstagramWorker] URL verification failed for ${target_id}, proceeding anyway. Error: ${err.message}`);
  }

  // Ensure the node is connected
  const socketId = await redisClient.hget('connectedNodes', node_id);
  if (!socketId) {
    throw new Error(`Node ${node_id} is not currently connected to the cloud!`);
  }

  // Acquire node lock with 5-minute TTL
  const lockKey = `nodeLock_v2:${node_id}`;
  const lockAcquired = await redisClient.set(lockKey, "1", "EX", 300, "NX");
  
  if (!lockAcquired) {
    throw new Error(`Node ${node_id} is currently busy processing another job. Retrying later...`);
  }

  const controller = new RemoteShizukuController(node_id);
  const engager = new InstagramEngager(node_id, controller);
  
  try {
    if (type === 'post') {
      // Like + Comment (MVP primary action, now with optional Follow/Save)
      if (shouldFollow) console.log(`[InstagramWorker] Job ${job.id}: Follow enabled for post ${target_id}`);
      if (shouldSave) console.log(`[InstagramWorker] Job ${job.id}: Save enabled for post ${target_id}`);
      await engager.engagePost(target_id, message, shouldSave, shouldFollow);
    } else if (type === 'like') {
      // Like only
      await engager.likePost(target_id);
    } else if (type === 'comment') {
      // Comment only
      await engager.commentOnPost(target_id, message);
    } else if (type === 'follow' || type === 'save') {
      // BACKLOG: follow and save — planned for v2.1
      console.log(`[InstagramWorker] Job type '${type}' is in backlog — skipping job ${job.id}.`);
    } else {
      throw new Error(`Unknown Instagram job type: ${type}`);
    }
    console.log(`[InstagramWorker] Job ${job.id} completed successfully`);
  } catch (error: any) {
    console.error(`[InstagramWorker] Error in job ${job.id}:`, error.message);
    throw error;
  } finally {
    await redisClient.del(lockKey);
  }
}, { 
  connection,
  concurrency: 5 
});

// Event listeners for monitoring
instagramWorker.on('completed', (job: Job) => {
  console.log(`[InstagramWorker] LinkedIn Job ${job.id} completed successfully`);
});

instagramWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[InstagramWorker] Instagram Job ${job?.id} failed with ${err.message}`);
});
