import { v4 as uuidv4 } from 'uuid';
import { perceptionEngine } from './PerceptionEngine';
import { jobQueue } from '../queue/Dispatcher';
import { telemetryEvents } from '../api/Server';
import { PrismaClient } from '@prisma/client';
import zlib from 'zlib';

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
                shellCommand = `input tap ${target.x} ${target.y}`;
                actionParams = { command: shellCommand };
                actionSummary = `Clicked at (${target.x}, ${target.y})`;
            } else if (target.action === 'swipe') {
                shellCommand = `input swipe ${target.start_x} ${target.start_y} ${target.end_x} ${target.end_y} 500`;
                actionParams = { command: shellCommand };
                actionSummary = `Swiped from (${target.start_x}, ${target.start_y}) to (${target.end_x}, ${target.end_y})`;
            } else if (target.action === 'type') {
                actionName = 'paste_text';
                actionParams = { text: target.text };
                actionSummary = `Typed text: "${target.text}"`;
            } else if (target.action === 'long_press') {
                shellCommand = `input swipe ${target.x} ${target.y} ${target.x} ${target.y} 1000`;
                actionParams = { command: shellCommand };
                actionSummary = `Long pressed at (${target.x}, ${target.y})`;
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
