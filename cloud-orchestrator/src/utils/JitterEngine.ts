import { Logger } from './Logger';

/**
 * JitterEngine (Ported from Founders-Product)
 * Implements Gaussian-distributed temporal pacing for engagement waves to bypass anti-bot detection.
 */
export class JitterEngine {
    private static readonly MU_OFFSET_SECONDS = 45.0;
    private static readonly SIGMA_SECONDS = 12.0;
    private static readonly MIN_OFFSET_SECONDS = 5.0;
    private static readonly MAX_OFFSET_SECONDS = 120.0;

    /**
     * Box-Muller transform to generate a normally distributed random number.
     */
    private static randomGaussian(mean: number, stdDev: number): number {
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random(); // Converting [0,1) to (0,1)
        while (u2 === 0) u2 = Math.random();
        
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /**
     * Calculates an organic temporal offset for an engagement task in a wave.
     * @param index Position of this task in the execution order (0-based)
     * @param totalSessions Total number of sessions in the wave
     * @returns Delay in milliseconds before this task should execute
     */
    static calculatePacingOffsetMs(index: number, totalSessions: number): number {
        const baseDelay = index * this.MU_OFFSET_SECONDS;
        const noise = this.randomGaussian(0, this.SIGMA_SECONDS);
        
        let offset = baseDelay + noise;
        
        // Clamp bounds
        const maxAllowed = this.MAX_OFFSET_SECONDS * totalSessions;
        offset = Math.max(this.MIN_OFFSET_SECONDS, Math.min(offset, maxAllowed));

        Logger.debug('Calculated Jitter Offset', {
            index,
            totalSessions,
            baseDelay: baseDelay.toFixed(2),
            noise: noise.toFixed(2),
            finalOffsetSec: offset.toFixed(2)
        });

        return Math.round(offset * 1000); // Return in milliseconds
    }

    /**
     * Helper to simply pause execution natively in node
     */
    static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
