import { PerceptionEngine } from '../ai/PerceptionEngine';
import * as fs from 'fs';

async function run() {
    const engine = new PerceptionEngine();
    const imageBase64 = fs.readFileSync('/Users/cortex/.gemini/antigravity-ide/brain/2a4ec901-073c-4bb0-b652-9544e35a884f/scratch/reel_screen.png', 'base64');
    
    // We pass an empty XML to force it to use visual understanding
    const res = await engine.resolveTarget('Find the exact x, y coordinates of the comment button/icon.', '<hierarchy></hierarchy>', imageBase64);
    
    console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
