const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

const connection = new IORedis({ maxRetriesPerRequest: null });
const jobQueue = new Queue('node-jobs', { connection });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testMediaRelay() {
  const nodeId = 'ddf1aadb5f1c38f4'; // Hardcoded test node ID
  const actionJobId = uuidv4();
  
  await prisma.job.create({
    data: {
      id: actionJobId,
      nodeId: nodeId,
      action: 'download_media',
      payload: {
        url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png',
        file_name: 'pikachu.png'
      },
      status: 'PENDING'
    }
  });

  console.log(`Dispatching download_media to ${nodeId}...`);
  await jobQueue.add('dispatch-job', {
    node_id: nodeId,
    action: 'download_media',
    params: {
      url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', // Pikachu sprite
      file_name: 'pikachu.png'
    }
  }, { jobId: actionJobId });

  console.log('Job dispatched!');
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

testMediaRelay();
