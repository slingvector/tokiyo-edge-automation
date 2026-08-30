import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCompiledScriptJob } from '../CompiledScriptDispatcher';
import { JitterEngine } from '../../utils/JitterEngine';
import { Job } from 'bullmq';

// Fix hoisting issue by using vi.hoisted
const {
    mockPrismaUpdate,
    mockPrismaFindUnique,
    mockRedisHget,
    mockIoEmit,
    mockIoTo,
    mockFcmSend
} = vi.hoisted(() => {
    const emit = vi.fn();
    return {
        mockPrismaUpdate: vi.fn().mockResolvedValue({}),
        mockPrismaFindUnique: vi.fn().mockResolvedValue({ fcmToken: 'test-token' }),
        mockRedisHget: vi.fn().mockResolvedValue(null),
        mockIoEmit: emit,
        mockIoTo: vi.fn(() => ({ emit })),
        mockFcmSend: vi.fn().mockResolvedValue('sent')
    };
});

// --- Mocks ---
vi.mock('bullmq', () => ({
  Queue: vi.fn(),
  Worker: vi.fn(),
}));

vi.mock('@prisma/client', () => {
    class PrismaClientMock {
        job = { update: mockPrismaUpdate };
        node = { findUnique: mockPrismaFindUnique };
    }
    return { PrismaClient: PrismaClientMock };
});

vi.mock('../../api/Server', () => ({
    redisClient: { hget: mockRedisHget },
    io: { to: mockIoTo }
}));

vi.mock('../../fcm/FirebaseAdmin', () => ({
    messaging: { send: mockFcmSend }
}));

vi.mock('../../crypto/Signer', () => ({
    signer: { signPayload: vi.fn().mockReturnValue({ signature: 'mock_sig' }) }
}));

vi.spyOn(JitterEngine, 'calculatePacingOffsetMs').mockReturnValue(500);
vi.spyOn(JitterEngine, 'delay').mockResolvedValue(undefined);

describe('CompiledScriptDispatcher', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should process job, apply jitter, and dispatch via WebSocket if connected', async () => {
        // Node is connected via WebSocket
        mockRedisHget.mockResolvedValueOnce('socket-123');

        const mockJob = {
            id: 'job-1',
            data: {
                node_id: 'node-A',
                script: 'echo test',
                execution_index: 2,
                total_sessions: 10
            }
        } as unknown as Job;

        await processCompiledScriptJob(mockJob);

        // Jitter should be called because execution_index and total_sessions are present
        expect(JitterEngine.calculatePacingOffsetMs).toHaveBeenCalledWith(2, 10);
        expect(JitterEngine.delay).toHaveBeenCalledWith(500);

        // Should update status to DISPATCHED
        expect(mockPrismaUpdate).toHaveBeenCalledWith({
            where: { id: 'job-1' },
            data: { status: 'DISPATCHED' }
        });

        // Should emit via WebSocket
        expect(mockIoTo).toHaveBeenCalledWith('socket-123');
        expect(mockIoEmit).toHaveBeenCalledWith('dispatch_compiled_script', { signature: 'mock_sig' });
        
        // Should NOT emit via FCM
        expect(mockFcmSend).not.toHaveBeenCalled();
    });

    it('should fallback to FCM if WebSocket is disconnected', async () => {
        // Node is NOT connected via WebSocket
        mockRedisHget.mockResolvedValueOnce(null);

        const mockJob = {
            id: 'job-2',
            data: {
                node_id: 'node-B',
                script: 'echo test2'
            }
        } as unknown as Job;

        await processCompiledScriptJob(mockJob);

        // Jitter should NOT be called because indexing is missing
        expect(JitterEngine.calculatePacingOffsetMs).not.toHaveBeenCalled();

        // Should emit via FCM
        expect(mockFcmSend).toHaveBeenCalled();
        expect(mockIoEmit).not.toHaveBeenCalled();
    });

    it('should throw error and update DB if FCM fallback is needed but token is missing', async () => {
        mockRedisHget.mockResolvedValueOnce(null);
        mockPrismaFindUnique.mockResolvedValueOnce({ fcmToken: null }); // Simulate missing token

        const mockJob = {
            id: 'job-3',
            data: {
                node_id: 'node-C',
                script: 'echo test3'
            }
        } as unknown as Job;

        await expect(processCompiledScriptJob(mockJob)).rejects.toThrow('Node node-C is disconnected and lacks an FCM token.');

        // Should update status to FAILED in DB
        expect(mockPrismaUpdate).toHaveBeenCalledWith({
            where: { id: 'job-3' },
            data: { status: 'FAILED', errorReason: 'Node node-C is disconnected and lacks an FCM token.' }
        });
    });
});
