export interface PerceptionResult {
    x?: number;
    y?: number;
    action: 'click' | 'click_element' | 'swipe' | 'type' | 'long_press' | 'done' | 'rescue';
    start_x?: number;
    start_y?: number;
    end_x?: number;
    end_y?: number;
    text?: string;
    semantic_text?: string;
    resource_id?: string;
    reasoning: string;
}
export declare class PerceptionEngine {
    /**
     * Optionally prune the XML to save tokens by removing non-essential attributes
     * like password, checkable, checked, etc.
     */
    private pruneXml;
    resolveTarget(goal: string, xmlDump: string, imageBase64?: string, history?: string[]): Promise<PerceptionResult>;
    private mapResult;
}
export declare const perceptionEngine: PerceptionEngine;
//# sourceMappingURL=PerceptionEngine.d.ts.map