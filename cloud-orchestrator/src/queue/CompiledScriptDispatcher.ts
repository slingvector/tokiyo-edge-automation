import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { signer } from '../crypto/Signer';
import { PrismaClient } from '@prisma/client';
import { io, redisClient } from '../api/Server';
import { messaging } from '../fcm/FirebaseAdmin';
import { Logger } from '../utils/Logger';
import { JitterEngine } from '../utils/JitterEngine';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
connection.on('connect', () => console.log('[CompiledWorker] Connected to Redis!'));
connection.on('error', (err) => console.error('[CompiledWorker] Redis error:', err));

const prisma = new PrismaClient();

// Queue for Compiled Scripts
export const compiledJobQueue = new Queue('compiled-scripts-jobs', { connection });

/**
 * Extracted processor function for testability.
 */
export const processCompiledScriptJob = async (job: Job) => {
  const { node_id, script, execution_index, total_sessions } = job.data;
  
  Logger.info(`Processing compiled script job`, { jobId: job.id, nodeId: node_id });

  // 1. Apply Jitter if index is provided (for batch waves)
  if (execution_index !== undefined && total_sessions !== undefined) {
    const delayMs = JitterEngine.calculatePacingOffsetMs(execution_index, total_sessions);
    Logger.info(`Applying Jitter Engine delay`, { jobId: job.id, delayMs });
    await JitterEngine.delay(delayMs);
  }

  // 2. Check if node is connected via WebSocket
  const socketId = await redisClient.hget('connectedNodes', node_id);

  // 3. Sign the payload (must match Android verification)
  const signedPayload = signer.signPayload({
    job_id: job.id,
    node_id,
    action: 'execute_compiled_script',
    params: {
        script: script
    }
  });

  try {
    await prisma.job.update({
      where: { id: job.id! },
      data: { status: 'DISPATCHED' }
    });

    // 4. Dispatch
    if (socketId) {
      io.to(socketId).emit('dispatch_compiled_script', signedPayload);
      Logger.info(`Successfully emitted compiled script to socket`, { jobId: job.id, socketId });
    } else {
      // FCM Fallback
      const node = await prisma.node.findUnique({ where: { id: node_id } });
      if (!node || !node.fcmToken) {
        throw new Error(`Node ${node_id} is disconnected and lacks an FCM token.`);
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
      Logger.info(`Successfully emitted compiled script via FCM`, { jobId: job.id, nodeId: node_id });
    }
  } catch (error: any) {
    Logger.error(`Error dispatching compiled script job`, { jobId: job.id, error: error.message });
    
    await prisma.job.update({
      where: { id: job.id! },
      data: { status: 'FAILED', errorReason: error.message }
    });

    throw error;
  }
};

/**
 * Worker for dispatching compiled Shell Scripts to dumb Edge devices.
 * Implements JitterEngine pacing and structured telemetry logging.
 */
export const compiledWorker = new Worker('compiled-scripts-jobs', processCompiledScriptJob, { 
  connection,
  concurrency: 50 // Edge devices handle this offline, so concurrency can be much higher!
});
