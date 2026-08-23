import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { signer } from '../crypto/Signer';
import { PrismaClient } from '@prisma/client';
import { io, redisClient } from '../api/Server';
import { messaging } from '../fcm/FirebaseAdmin';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

// The Job Queue
export const jobQueue = new Queue('node-jobs', { connection });

// The Worker (Dispatcher)
export const worker = new Worker('node-jobs', async (job: Job) => {
  const { node_id, action, params } = job.data;
  
  console.log(`[Dispatcher] Processing job ${job.id} for node ${node_id}`);

  // Check if node is connected using Redis
  const socketId = await redisClient.hget('connectedNodes', node_id);

  // 1. Sign the payload
  const signedPayload = signer.signPayload({
    job_id: job.id,
    node_id,
    action,
    params
  });

  try {
    // Update DB status to DISPATCHED
    await prisma.job.update({
      where: { id: job.id! },
      data: { status: 'DISPATCHED' }
    });

    // 2. Dispatch via WebSocket or FCM
    if (socketId) {
      io.to(socketId).emit('dispatch_job', signedPayload);
      console.log(`[Dispatcher] Successfully emitted job ${job.id} to socket ${socketId}`);
    } else {
      const node = await prisma.node.findUnique({ where: { id: node_id } });
      if (!node || !node.fcmToken) {
        throw new Error(`Node ${node_id} is not connected to WebSockets and has no FCM token registered.`);
      }
      
      await messaging.send({
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

  } catch (error: any) {
    console.error(`[Dispatcher] Error dispatching job ${job.id}:`, error.message);
    
    // Update DB status to FAILED
    await prisma.job.update({
      where: { id: job.id! },
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
