import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptCompilerService } from '../ScriptCompilerService';

// Mock Redis to avoid requiring a real Redis instance for tests
vi.mock('ioredis', () => {
    const RedisMock = vi.fn();
    RedisMock.prototype.set = vi.fn().mockResolvedValue('OK');
    RedisMock.prototype.get = vi.fn().mockResolvedValue(null);
    return { default: RedisMock };
});

describe('ScriptCompilerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should correctly inject variables into template', () => {
        const template = `input text "%%COMMENT%%"\nsleep 1\ninput tap %%X%% %%Y%%`;
        const variables = {
            COMMENT: 'Awesome post!',
            X: '500',
            Y: '600'
        };

        const result = ScriptCompilerService.injectVariables(template, variables);
        expect(result).toBe(`input text "Awesome post!"\nsleep 1\ninput tap 500 600`);
    });

    it('should escape single quotes securely to prevent bash injection', () => {
        const template = `input text '%%COMMENT%%'`;
        const variables = {
            COMMENT: "It's a great day!"
        };

        const result = ScriptCompilerService.injectVariables(template, variables);
        
        // Single quotes in bash are escaped as '\'' to close, escape, open
        expect(result).toBe(`input text 'It'\\''s a great day!'`);
    });

    it('should cache compiled script', async () => {
        await expect(ScriptCompilerService.cacheCompiledScript('id-1', 'script')).resolves.not.toThrow();
    });

    it('should get cached script', async () => {
        await expect(ScriptCompilerService.getCachedScript('id-1')).resolves.toBe(null);
    });

    it('should throw error and log if caching fails', async () => {
        const ioredis = await import('ioredis');
        vi.mocked(ioredis.default.prototype.set).mockRejectedValueOnce(new Error('Redis Cache Error'));
        await expect(ScriptCompilerService.cacheCompiledScript('id-error', 'script')).rejects.toThrow('Redis Cache Error');
    });

    it('should throw error and log if get fails', async () => {
        const ioredis = await import('ioredis');
        vi.mocked(ioredis.default.prototype.get).mockRejectedValueOnce(new Error('Redis Get Error'));
        await expect(ScriptCompilerService.getCachedScript('id-error')).rejects.toThrow('Redis Get Error');
    });
});
