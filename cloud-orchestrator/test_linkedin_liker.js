const { extractLinkedInUrls } = require('./src/utils/excelParser');

const NODE_ID = "ddf1aadb5f1c38f4"; 
const EXCEL_FILE = '/Users/cortex/ventures/tokiyo-edge-automation/docs/dumb-data/AggregateAnalytics_Anuj Kumar_2026-08-06_2026-08-12.xlsx';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    console.log("Loading Excel file...");
    const urls = extractLinkedInUrls(EXCEL_FILE);
    
    // Apply Arithmetic Progression (d = 2) starting from index 0
    const testUrls = [];
    for (let i = 0; i < urls.length; i += 2) {
        testUrls.push(urls[i]);
    }
    
    // Limit to 5 targets for testing phase 1 to get a quick success metric
    const maxTests = Math.min(testUrls.length, 5);
    
    console.log(`Extracted ${urls.length} total URLs. AP(d=2) yields ${testUrls.length}. Running ${maxTests} tests.`);
    
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < maxTests; i++) {
        const url = testUrls[i];
        console.log(`\n===========================================`);
        console.log(`[${i+1}/${maxTests}] Launching post: ${url}`);
        
        await fetch("http://localhost:3000/api/v1/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: NODE_ID,
                action: "deep_link",
                params: { url: url, package: "com.linkedin.android" }
            })
        });
        
        console.log("Waiting 10 seconds for the app to load...");
        await sleep(10000);
        
        console.log("Dispatching AI goal for React & Comment");
        
        // Multi-step goal for React AND Comment
        const smartGoal = `
            Task: React to the main LinkedIn post and leave a context-aware professional comment.
            CRITICAL RULES:
            1. First, you MUST use the 'long_press' action on the main 'Like' button (thumbs up icon) in the post's primary interaction bar. Do not just click it.
            2. After long pressing, a popup with reaction icons will appear. Choose ONE of the following reactions based on the post context (if visible) or choose randomly: 'Celebrate', 'Support', 'Love', or 'Insightful'. Use 'click_element' or 'click' to select it.
            3. To comment, explicitly click the 'Comment' button or input field.
            4. Use the 'type' action to type a short, professional comment that is highly contextual to the post content you can read on screen. (e.g. "Great milestone!" or "Thanks for sharing these insights.")
            5. **CRITICAL:** After typing, you MUST click the specific 'Post' button (often located on the right side of the screen or bottom sheet). Do not guess random coordinates; look for the semantic word 'Post'.
            6. Once BOTH the Reaction and the Comment are completed and published, return 'done'.
            7. Do NOT interact with other people's comments.
        `.trim();

        const res = await fetch("http://localhost:3000/api/v1/agent/autonomous", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              node_id: NODE_ID,
              goal: smartGoal,
              max_steps: 12 // Increased due to long_press, popup selection, comment, post.
            })
        });
        
        const data = await res.json();
        const sessionId = data.session_id;
        console.log(`Autonomous Job Started: ${sessionId}`);
        
        // Polling loop
        let isDone = false;
        while (!isDone) {
            await sleep(5000); // Check every 5 seconds
            try {
                const pollRes = await fetch(`http://localhost:3000/api/v1/agent/autonomous/${sessionId}`);
                if (pollRes.ok) {
                    const statusData = await pollRes.json();
                    if (statusData.state === 'completed') {
                        const resultStatus = statusData.result?.status;
                        if (resultStatus === 'SUCCESS') {
                            console.log(`✅ Session completed successfully! Steps taken: ${statusData.result.steps}`);
                            successCount++;
                        } else {
                            console.log(`❌ Session failed softly: ${statusData.result?.reason}`);
                            failCount++;
                        }
                        isDone = true;
                    } else if (statusData.state === 'failed') {
                        console.log(`❌ Session crashed with error: ${statusData.error}`);
                        failCount++;
                        isDone = true;
                    } else {
                        console.log(`[Status] Session ${sessionId} is ${statusData.state}...`);
                    }
                }
            } catch (err) {
                console.log("Error polling status:", err.message);
            }
        }
    }
    
    console.log(`\n===========================================`);
    console.log(`Final Success Rate: ${successCount}/${maxTests} (${(successCount/maxTests * 100).toFixed(2)}%)`);
    console.log(`===========================================`);
}

run().catch(console.error);
