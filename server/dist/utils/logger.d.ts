/**
 * Logger Utility
 * Winston-based structured logging
 */
import winston from 'winston';
import type { Config } from '../config.js';
/**
 * Initialize logger with configuration
 */
export declare function initLogger(config: Config['logging']): winston.Logger;
/**
 * Get logger instance
 */
export declare function getLogger(): winston.Logger;
/**
 * Create a child logger with additional context
 */
export declare function createChildLogger(context: Record<string, unknown>): winston.Logger;
//# sourceMappingURL=logger.d.ts.map