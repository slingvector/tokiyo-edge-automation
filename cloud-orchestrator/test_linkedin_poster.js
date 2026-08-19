const { io } = require("socket.io-client");

const NODE_ID = "ddf1aadb5f1c38f4";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
    // Array of simple text posts to test
    const postsToGenerate = [
        "Just testing out an incredible new autonomous agent framework! #automation #ai #mobile",
        "Exploring the intersection of edge computing and LLMs today. The latency improvements are game-changing! 🚀"
    ];

    for (let i = 0; i < postsToGenerate.length; i++) {
        const postText = postsToGenerate[i];
        console.log(`\n===========================================`);
        console.log(`[${i+1}/${postsToGenerate.length}] Generating Post: "${postText.substring(0, 30)}..."`);
        
        // 1. Force Stop LinkedIn to ensure clean state
        await fetch("http://localhost:3000/api/v1/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: NODE_ID,
                action: "force_stop",
                params: { package: "com.linkedin.android" }
            })
        });
        await sleep(3000);

        // 2. Launch LinkedIn app
        await fetch("http://localhost:3000/api/v1/jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: NODE_ID,
                action: "shell",
                params: { command: "monkey -p com.linkedin.android -c android.intent.category.LAUNCHER 1" }
            })
        });
        
        console.log("Waiting 15 seconds for the app to load...");
        await sleep(15000);
        
        console.log("Dispatching AI goal to create a Post...");
        
        const smartGoal = `
            Task: Create a new LinkedIn post with the provided text.
            CRITICAL RULES:
            1. You are on the LinkedIn Home feed. Find and click the 'Start a post' button or input area (usually at the top of the feed, near the user's avatar). Use 'click_element' or 'click'.
            2. Once the post creation screen opens, use the 'type' action to paste the following exact text: "${postText}"
            3. After typing, you MUST click the 'Post' button (usually at the top right of the screen or bottom right). 
            4. Do not attach any images or videos for this task.
            5. Once the post is submitted and you are back on the feed, return 'done'.
        `.trim();

        const res = await fetch("http://localhost:3000/api/v1/agent/autonomous", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              node_id: NODE_ID,
              goal: smartGoal,
              max_steps: 8
            })
        });
        
        if (!res.ok) {
            console.error("Failed to start autonomous job", await res.text());
            continue;
        }

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
                            console.log(`✅ Post generated successfully! Steps taken: ${statusData.result.steps}`);
                        } else {
                            console.log(`❌ Post generation failed softly: ${statusData.result?.reason}`);
                        }
                        isDone = true;
                    } else if (statusData.state === 'failed') {
                        console.log(`❌ Session crashed with error: ${statusData.error}`);
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
    console.log(`All post tests completed.`);
    console.log(`===========================================`);
}

run().catch(console.error);
