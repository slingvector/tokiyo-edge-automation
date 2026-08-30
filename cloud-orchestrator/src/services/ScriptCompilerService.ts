import IORedis from 'ioredis';
import { Logger } from '../utils/Logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = new IORedis(redisUrl);

/**
 * Service responsible for managing Compiled Shell Scripts.
 * Caches resolution-independent bash scripts that can be executed natively on edge devices.
 */
export class ScriptCompilerService {
    
    /**
     * Stores a compiled script in Redis with an optional TTL.
     */
    static async cacheCompiledScript(scriptId: string, scriptContent: string, ttlSeconds: number = 86400): Promise<void> {
        try {
            await redisClient.set(`compiled_script:${scriptId}`, scriptContent, 'EX', ttlSeconds);
            Logger.info(`Cached compiled script`, { scriptId, ttlSeconds });
        } catch (error: any) {
            Logger.error(`Failed to cache compiled script`, { scriptId, error: error.message });
            throw error;
        }
    }

    /**
     * Retrieves a cached script from Redis.
     */
    static async getCachedScript(scriptId: string): Promise<string | null> {
        try {
            const script = await redisClient.get(`compiled_script:${scriptId}`);
            if (script) {
                Logger.debug(`Retrieved compiled script from cache`, { scriptId });
            } else {
                Logger.warn(`Compiled script not found in cache`, { scriptId });
            }
            return script;
        } catch (error: any) {
            Logger.error(`Failed to retrieve compiled script`, { scriptId, error: error.message });
            throw error;
        }
    }

    /**
     * Injects dynamic variables (like comments, URLs) into a compiled script template.
     * Example template: `input text "%%COMMENT%%"`
     */
    static injectVariables(scriptTemplate: string, variables: Record<string, string>): string {
        let injectedScript = scriptTemplate;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `%%${key}%%`;
            // Escape single quotes for bash safety if it's being inserted into an 'input text' command
            const safeValue = value.replace(/'/g, "'\\''");
            injectedScript = injectedScript.replace(new RegExp(placeholder, 'g'), safeValue);
        }
        return injectedScript;
    }
}
