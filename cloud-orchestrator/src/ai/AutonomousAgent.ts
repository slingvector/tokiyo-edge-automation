import { v4 as uuidv4 } from 'uuid';
import { perceptionEngine } from './PerceptionEngine';
import { jobQueue } from '../queue/Dispatcher';
import { telemetryEvents } from '../api/Server';
import { PrismaClient } from '@prisma/client';
import zlib from 'zlib';
import { DeepLinkRegistry } from '../services/DeepLinkRegistry';

const prisma = new PrismaClient();

export class AutonomousAgent {
    constructor(
        private nodeId: string,
        private goal: string,
        private maxSteps: number = 10
    ) {}

    public async run() {
        console.log(`[AutonomousAgent] Starting session for node ${this.nodeId}. Goal: "${this.goal}"`);
        const history: string[] = [];

        for (let step = 1; step <= this.maxSteps; step++) {
            console.log(`[AutonomousAgent] Step ${step}/${this.maxSteps}`);
            
            // 0. Deep Link Intent Fallback (APK Intelligence)
            const packageName = "com.linkedin.android"; // Hardcoded for this test phase
            const shortcutLink = DeepLinkRegistry.findDeepLinkForGoal(packageName, this.goal);
            
            if (shortcutLink && step === 1) {
                const filters = shortcutLink.intent_filters;
                let url = "";
                if (filters.data && filters.data.length > 0) {
                    const d = filters.data[0];
                    url = `${d.scheme || 'https'}://${d.host || ''}${d.pathPrefix || ''}`;
                }
                
                if (url) {
                    console.log(`[AutonomousAgent] ⚡ DEEP LINK SHORTCUT FOUND: ${url}`);
                    history.push(`Step 0: Invoked intent fallback for ${url} based on goal.`);
                    
                    const intentJobId = uuidv4();
                    await prisma.job.create({
                        data: {
                            id: intentJobId,
                            nodeId: this.nodeId,
                            action: 'deep_link',
                            payload: { url: url, package: packageName },
                            status: 'PENDING'
                        }
                    });

                    await jobQueue.add('dispatch-job', {
                        node_id: this.nodeId,
                        action: 'deep_link',
                        params: { url: url, package: packageName }
                    }, { jobId: intentJobId });

                    // Give the app 2 seconds to launch and settle before we take the first UI dump
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            // 1. Perceive
            const dumpJobId = uuidv4();
            await prisma.job.create({
                data: {
                    id: dumpJobId,
                    nodeId: this.nodeId,
                    action: 'dump_ui',
                    payload: {},
                    status: 'PENDING'
                }
            });

            await jobQueue.add('dispatch-job', {
                node_id: this.nodeId,
                action: 'dump_ui',
                params: {}
            }, { jobId: dumpJobId });

            const telemetryData: any = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Timeout waiting for UI dump")), 15000);
                telemetryEvents.once(`telemetry_${dumpJobId}`, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });
            });

            if (!telemetryData.ui_dump) {
                throw new Error("Failed to receive UI dump from Edge Node.");
            }

            // 2. Extract Data
            const cleanUiDump = telemetryData.ui_dump.replace("UI hierchary dumped to: /data/local/tmp/dump.xml", "").trim();
            let xmlDump;
            try {
                const xmlBuffer = zlib.gunzipSync(Buffer.from(cleanUiDump, 'base64'));
                xmlDump = xmlBuffer.toString('utf-8');
            } catch (gzErr) {
                xmlDump = Buffer.from(cleanUiDump, 'base64').toString('utf-8');
            }
            
            let imageBase64;
            if (telemetryData.screenshot) {
               try {
                   const imgBuffer = zlib.gunzipSync(Buffer.from(telemetryData.screenshot, 'base64'));
                   imageBase64 = imgBuffer.toString('base64');
               } catch (gzErr) {
                   imageBase64 = telemetryData.screenshot;
               }
            }

            // 3. Reason
            console.log(`[AutonomousAgent] Calling Perception Engine...`);
            const target = await perceptionEngine.resolveTarget(this.goal, xmlDump, imageBase64, history);
            console.log(`[AutonomousAgent] Decision: ${target.action}. Reasoning: ${target.reasoning}`);

            if (target.action === 'done') {
                console.log(`[AutonomousAgent] Goal Achieved!`);
                return { status: 'SUCCESS', steps: step, history };
            }

            if (target.action === 'rescue') {
                console.log(`[AutonomousAgent] Popup/Modal detected! Triggering Recursive PopupRescue Agent...`);
                history.push(`Step ${step}: Detected popup, triggered PopupRescue Sub-Agent.`);
                
                const rescueAgent = new AutonomousAgent(
                    this.nodeId, 
                    "Dismiss any visible popups, dialogs, alerts, or modals. Just close it. Do not interact with the background app.", 
                    3
                );
                
                const rescueResult = await rescueAgent.run();
                
                if (rescueResult.status === 'SUCCESS') {
                    console.log(`[AutonomousAgent] PopupRescue successful! Resuming primary workflow...`);
                    history.push(`Step ${step} (Sub-Agent): Successfully dismissed popup.`);
                    continue; // Skip the rest of this loop and pull a fresh UI dump next iteration
                } else {
                    console.log(`[AutonomousAgent] PopupRescue failed to dismiss popup. Aborting primary workflow.`);
                    return { status: 'FAILED', reason: 'RESCUE_FAILED', history };
                }
            }

            // 4. Act
            let actionName = 'shell';
            let actionParams: any = {};
            let actionSummary = '';
            let shellCommand = '';

            if (target.action === 'click_element') {
                actionName = 'click_element';
                actionParams = { text: target.semantic_text, resource_id: target.resource_id };
                actionSummary = `Clicked element (text="${target.semantic_text}", id="${target.resource_id}")`;
            } else if (target.action === 'click') {
                actionName = 'organic_tap';
                actionParams = { x: target.x, y: target.y };
                actionSummary = `Organic clicked at (${target.x}, ${target.y})`;
            } else if (target.action === 'click_unmerge') {
                actionName = 'organic_tap';
                const ApkAnalyzerClient = require('../services/ApkAnalyzerClient').ApkAnalyzerClient;
                const analyzer = new ApkAnalyzerClient();
                
                console.log(`[AutonomousAgent] Intercepting for Unmerge Routine. Targeting text: "${target.semantic_text}" inside bbox: ${target.bbox}`);
                
                const unmergeResult = await analyzer.unmergeCompose(
                    imageBase64,
                    target.semantic_text,
                    target.bbox // [l, t, r, b]
                );
                
                if (unmergeResult.found) {
                    actionParams = { x: unmergeResult.x, y: unmergeResult.y };
                    actionSummary = `Unmerged visual crop and organic clicked at precise coordinate (${unmergeResult.x}, ${unmergeResult.y})`;
                } else {
                    console.error("[AutonomousAgent] Unmerge Vision Failed:", unmergeResult.error);
                    throw new Error(`Unmerge Vision Failed: ${unmergeResult.error}`);
                }
            } else if (target.action === 'swipe') {
                actionName = 'organic_swipe';
                actionParams = { start_x: target.start_x, start_y: target.start_y, end_x: target.end_x, end_y: target.end_y, duration_ms: 500 };
                actionSummary = `Organic swiped from (${target.start_x}, ${target.start_y}) to (${target.end_x}, ${target.end_y})`;
            } else if (target.action === 'type') {
                actionName = 'organic_type';
                actionParams = { text: target.text };
                actionSummary = `Organic typed text: "${target.text}"`;
            } else if (target.action === 'long_press') {
                actionName = 'organic_swipe';
                actionParams = { start_x: target.x, start_y: target.y, end_x: target.x, end_y: target.y, duration_ms: 1000 };
                actionSummary = `Organic long pressed at (${target.x}, ${target.y})`;
            } else {
                throw new Error(`Unknown action type: ${target.action}`);
            }

            history.push(`Step ${step}: ${actionSummary}. Reasoning: ${target.reasoning}`);

            const actionJobId = uuidv4();
            await prisma.job.create({
                data: {
                    id: actionJobId,
                    nodeId: this.nodeId,
                    action: actionName,
                    payload: actionParams,
                    status: 'PENDING'
                }
            });

            await jobQueue.add('dispatch-job', {
                node_id: this.nodeId, 
                action: actionName,
                params: actionParams
            }, { jobId: actionJobId });

            // Wait for action to complete before next step
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Timeout waiting for physical action")), 15000);
                telemetryEvents.once(`telemetry_${actionJobId}`, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });
            });
            
            console.log(`[AutonomousAgent] Action executed successfully.`);
        }

        console.log(`[AutonomousAgent] Maximum steps reached (${this.maxSteps}). Failing.`);
        return { status: 'FAILED', reason: 'MAX_STEPS_REACHED', history };
    }
}
