const axios = require('axios');

async function runFSM() {
    console.log("Starting Tokiyo Edge FSM Autonomous Session...");
    try {
        const response = await axios.post('http://localhost:3000/api/v1/agent/autonomous', {
            goal: "Click on the user profile, wait, and swipe left",
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

runFSM();
