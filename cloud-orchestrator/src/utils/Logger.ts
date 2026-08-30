// Native Date implementation

/**
 * Structured JSON Logger adhering to BACKEND-STANDARDS.
 * Emits JSON payload for easy ingestion by Datadog, ELK, or GCP Logging.
 */
export class Logger {
    private static formatMessage(level: string, message: string, context?: Record<string, any>) {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...context
        };
        return JSON.stringify(payload);
    }

    static info(message: string, context?: Record<string, any>) {
        console.log(this.formatMessage('INFO', message, context));
    }

    static warn(message: string, context?: Record<string, any>) {
        console.warn(this.formatMessage('WARN', message, context));
    }

    static error(message: string, context?: Record<string, any>) {
        console.error(this.formatMessage('ERROR', message, context));
    }

    static debug(message: string, context?: Record<string, any>) {
        if (process.env.LOG_LEVEL === 'DEBUG') {
            console.debug(this.formatMessage('DEBUG', message, context));
        }
    }
}
