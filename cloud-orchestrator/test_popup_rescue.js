const axios = require('axios');
const { execSync } = require('child_process');

async function run() {
    console.log("Starting Tokiyo Edge FSM Popup Rescue Scenario...");

    // Spawn a blocking UI element (Notification shade) via ADB
    console.log("Triggering unexpected overlay (Notification Shade)...");
    execSync('~/Library/Android/sdk/platform-tools/adb shell cmd statusbar expand-notifications');

    // Wait a second for it to expand
    await new Promise(r => setTimeout(r, 1000));

    // The agent's goal is to tap a specific app on the home screen.
    // However, the notification shade is blocking the screen!
    try {
        const response = await axios.post('http://localhost:3000/api/v1/agent/autonomous', {
            node_id: "ddf1aadb5f1c38f4",
            goal: "Open the 'Phone' or 'Dialer' app on the home screen.",
            max_steps: 5
        });
        
        console.log("Session Started:", response.data);
        const sessionId = response.data.session_id;

        // Poll for session status
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await axios.get(`http://localhost:3000/api/v1/agent/autonomous/${sessionId}`);
            console.log(`[Status] ${statusResponse.data.state}`);
            
            if (statusResponse.data.state === 'completed' || statusResponse.data.state === 'failed') {
                console.log("Session Result:", statusResponse.data);
                break;
            }
        }
    } catch (e) {
        console.error("Error starting FSM session:", e.response?.data || e.message);
    }
}

run().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
