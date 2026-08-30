import { describe, it, expect } from 'vitest';
import { JitterEngine } from '../JitterEngine';

describe('JitterEngine', () => {
    it('should generate delays within minimum logical bounds', () => {
        const totalSessions = 50;
        
        for (let i = 0; i < totalSessions; i++) {
            const delayMs = JitterEngine.calculatePacingOffsetMs(i, totalSessions);
            expect(delayMs).toBeGreaterThanOrEqual(5000); // 5 seconds in ms
        }
    });

    it('should scale base delay based on execution index', () => {
        const delayFirst = JitterEngine.calculatePacingOffsetMs(0, 10);
        const delayTenth = JitterEngine.calculatePacingOffsetMs(9, 10);
        
        // Index 9 has a base offset of 9 * 45s = 405s.
        // Index 0 has a base offset of 0s. 
        // With a sigma of 12s, the 9th item will statistically always have a larger delay than the 1st.
        expect(delayTenth).toBeGreaterThan(delayFirst);
    });

    it('delay method should pause execution', async () => {
        const start = Date.now();
        await JitterEngine.delay(50);
        const duration = Date.now() - start;
        expect(duration).toBeGreaterThanOrEqual(45); // small buffer for Node.js event loop scheduling
    });
});
