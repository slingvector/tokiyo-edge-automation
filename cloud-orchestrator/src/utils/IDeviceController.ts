export interface IDeviceController {
    deviceId: string;
    
    // Core FSM Execution API
    forceStopApp(packageName: string): Promise<void>;
    openDeepLink(url: string, packageName?: string): Promise<void>;
    tapCoordinate(x: number, y: number): Promise<void>;
    inputText(text: string): Promise<void>;
    pressEnter(): Promise<void>;
    pressBack(): Promise<void>;
    pressTab(): Promise<void>;
    swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void>;
    
    // Perception API
    getUiDumpXml(): Promise<string>;
    getOcrCoordinates(targetText: string): Promise<{x: number, y: number} | null>;
    
    // Utilities
    sleep(ms: number): Promise<void>;
}
