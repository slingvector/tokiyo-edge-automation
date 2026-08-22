import express from 'express';
import cors from 'cors';
import { LinkedInEngager } from './services/LinkedInEngager';

const app = express();
app.use(cors());
app.use(express.json());

const devices = ['emulator-5554', 'emulator-5556', 'emulator-5558'];
const engagers = devices.map(id => new LinkedInEngager(id));

let isProcessing = false;

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// In-memory queue (in production, use Redis/BullMQ)
const jobQueue: { url: string, comment: string }[] = [];

app.post('/engage', (req, res) => {
    const { posts } = req.body;
    
    if (!posts || !Array.isArray(posts)) {
        return res.status(400).json({ error: "Invalid request. Expected { posts: [{ url, comment }] }" });
    }

    jobQueue.push(...posts);
    
    // Start processing if not already doing so
    if (!isProcessing) {
        processQueue();
    }

    res.json({ status: "queued", queueLength: jobQueue.length });
});

app.get('/status', (req, res) => {
    res.json({ isProcessing, queueLength: jobQueue.length });
});

async function processQueue() {
    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue.shift();
        if (!job) continue;

        console.log(`\n=============================================`);
        console.log(`🚀 PROCESSING POST: ${job.url}`);
        console.log(`=============================================\n`);

        try {
            console.log(`\n--- PHASE 1: LIKE EVENT ---`);
            const likePromises = engagers.map((engager, index) => 
                engager.likePost(job.url)
                    .then(result => console.log(`[Emulator ${index + 1}] Like FSM: ${result ? '✅ Passed' : '❌ Failed'}`))
                    .catch(e => console.error(`[Emulator ${index + 1}] Like FSM Error:`, e))
            );
            await Promise.allSettled(likePromises);

            console.log(`\n--- PHASE 2: COMMENT EVENT ---`);
            const commentPromises = engagers.map((engager, index) => 
                engager.commentOnPost(job.url, job.comment)
                    .then(result => console.log(`[Emulator ${index + 1}] Comment FSM: ${result ? '✅ Passed' : '❌ Failed'}`))
                    .catch(e => console.error(`[Emulator ${index + 1}] Comment FSM Error:`, e))
            );
            await Promise.allSettled(commentPromises);

            console.log(`\n🎉 POST ENGAGEMENT CYCLE COMPLETE!`);
            
            if (jobQueue.length > 0) {
                console.log(`⏳ Waiting 20 seconds before starting the next post...`);
                await delay(20000);
            }
        } catch (error) {
            console.error("Critical error during processing:", error);
        }
    }

    isProcessing = false;
    console.log(`✅ Queue is now empty.`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Tokiyo Edge Cloud Orchestrator listening on port ${PORT}`);
});
