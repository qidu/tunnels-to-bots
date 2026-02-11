/**
 * Logger Utility
 * Winston-based structured logging
 */
import winston from 'winston';
let logger = null;
/**
 * Initialize logger with configuration
 */
export function initLogger(config) {
    const formatters = [
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
    ];
    if (config.format === 'json') {
        formatters.push(winston.format.json());
    }
    else {
        formatters.push(winston.format.colorize(), winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
        }));
    }
    const transports = [];
    if (config.output === 'stdout' || config.output.includes('stdout')) {
        transports.push(new winston.transports.Console());
    }
    logger = winston.createLogger({
        level: config.level,
        format: winston.format.combine(...formatters),
        transports,
        defaultMeta: { service: 'tunnels-to-bots' },
    });
    return logger;
}
/**
 * Get logger instance
 */
export function getLogger() {
    if (!logger) {
        // Return a basic console logger if not initialized
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
            transports: [new winston.transports.Console()],
        });
    }
    return logger;
}
/**
 * Create a child logger with additional context
 */
export function createChildLogger(context) {
    return getLogger().child(context);
}
//# sourceMappingURL=logger.js.map