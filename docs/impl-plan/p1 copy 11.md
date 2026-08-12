# Real-World Testing: LinkedIn Autonomous "Like" Agent

This plan outlines the architecture and execution steps for our first real-world autonomous test on a live LinkedIn account using the Android Emulator. The agent's goal is to autonomously navigate to a curated list of posts and "Like" them.

## User Review Required

> [!WARNING]
> **Live Account Usage:** We will be using a real LinkedIn account. Are you comfortable with the agent executing actions on this live profile? 
> Please ensure you are logged into the LinkedIn Android App on the emulator before we begin execution.

## The Dataset

I successfully parsed the provided Excel sheet (`AggregateAnalytics_Anuj Kumar_2026-08-06_2026-08-12.xlsx`) and extracted the target post URLs. Here are a few examples we will iterate through:

1. `https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_log-n-a-backend-lie-we-often-learn-that-ugcPost-7487469440754782209-1MoI`
2. `https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_rag-isnt-the-answer-we-built-our-first-ugcPost-7481399989282398208-j79i`
3. `https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_forget-the-resume-ai-is-changing-how-we-ugcPost-7477292798803800065-xjvd`
*(...and the rest of the 23 posts from the dataset)*

---

## Proposed Changes

We will create a dedicated Orchestrator script to manage this multi-step iteration.

### Cloud Orchestrator (`cloud-orchestrator/`)

#### [NEW] [test_linkedin_liker.js](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/test_linkedin_liker.js)
This script will import the parsed Excel data and run an autonomous loop for each post:
1. **Action 1 (`deep_link`):** Instruct the Edge Agent to open the specific LinkedIn post URL directly via Android intent (`com.linkedin.android`).
2. **Action 2 (`dump_ui`):** Request a visual and XML snapshot of the rendered post.
3. **Action 3 (AI Evaluation):** Feed the snapshot to Gemini Pro Vision. The AI will locate the "Like" button. It must also verify if the post is *already* liked to avoid un-liking it.
4. **Action 4 (`click_element`):** The agent clicks the Like button.
5. **Iteration:** Wait 3 seconds, then move to the next URL.

### Data Extraction Module

#### [NEW] [utils/excelParser.js](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/utils/excelParser.js)
A utility function utilizing the `xlsx` NPM package (which I have already installed) to programmatically extract the URLs from the `TOP POSTS` sheet at runtime so the script remains dynamic.

---

## Verification Plan

### Manual Verification
- **Prerequisite:** You must manually log into your LinkedIn account on the Android Emulator.
- **Execution:** We will run `node test_linkedin_liker.js`.
- **Validation:** You can physically watch the emulator screen as the app deep links into each post, pauses while Gemini evaluates the UI, and then autonomously taps the Like button before moving to the next.

**If you approve this plan, click Proceed and I will build the script and we can begin the live test!**
