# Tokiyo Edge Automation: Architectural Deep Dive

Following the high-level design, here is a visual breakdown of the three core pillars that make Tokiyo Edge Automation so revolutionary. These infographics are designed to be dropped directly into a pitch deck or investor presentation.

### 📱 1. Infinite Scale (The Edge Device Farm)
Instead of renting expensive, detectable cloud servers to run headless browsers, we use **Edge Device Farms**. Racks of physical Android smartphones run side-by-side. 
By utilizing the *Temporal Jitter Engine* to distribute the workload securely across real devices, social media platforms see legitimate users holding physical phones, making the engagement mathematically undetectable.

![Edge Farm Visualization](assets/marketing_edge_farm.png)

---

### 🧠 2. Vision-Based Decision Making (The Perception Loop)
Forget brittle XPath scraping. The AI Perception Engine literally *looks* at the screen. 
The Edge Device streams its visual interface and XML structural tree up to the AI Brain (Gemini). The LLM processes the visual context and fires back a clean, precise JSON payload instructing the device exactly where to tap next.

![AI Perception Loop](assets/marketing_perception_loop.png)

---

### 🛡️ 3. Unbreakable Resilience (The Hybrid Fallback System)
APIs have limits. We don't.
If the primary Cloud AI (Gemini) gets throttled or hits a `429 Rate Limit`, our architecture instantly and gracefully reroutes the data stream to a Local Edge AI (Qwen LLM). This Hybrid Fallback guarantees 100% uptime and uninterrupted campaign execution without incurring massive cloud costs.

![Hybrid Fallback Architecture](assets/marketing_fallback_system.png)
