export declare class AutonomousAgent {
    private nodeId;
    private goal;
    private maxSteps;
    constructor(nodeId: string, goal: string, maxSteps?: number);
    run(): Promise<{
        status: string;
        steps: number;
        history: string[];
        reason?: never;
    } | {
        steps?: never;
        status: string;
        reason: string;
        history: string[];
    }>;
}
//# sourceMappingURL=AutonomousAgent.d.ts.map