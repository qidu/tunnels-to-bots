/**
 * Tunnels-to-Bots Server Entry Point
 * Main application bootstrap and initialization
 */
import { Server } from './server.js';
import { loadConfig } from './config.js';
import { logger } from './utils/logger.js';
import { TunnelManager } from './tunnel-manager.js';
let server = null;
let tunnelManager = null;
/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    try {
        // Stop accepting new connections
        if (server) {
            await server.stop();
            logger.info('WebSocket server stopped');
        }
        // Stop tunnel manager
        if (tunnelManager) {
            await tunnelManager.stopAll();
            logger.info('Tunnel manager stopped');
        }
        logger.info('Graceful shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}
/**
 * Main bootstrap function
 */
async function main() {
    try {
        // Load configuration
        const configPath = process.env.CONFIG_PATH || './config.yaml';
        const config = await loadConfig(configPath);
        logger.info('Configuration loaded', {
            env: config.app.env,
            port: config.app.port,
            tunnelProvider: config.tunnels.defaultProvider,
        });
        // Initialize tunnel manager
        tunnelManager = new TunnelManager(config.tunnels);
        // Start default tunnel if configured
        const tunnelStatus = await tunnelManager.startDefault();
        if (tunnelStatus) {
            logger.info('Default tunnel started', {
                provider: tunnelStatus.provider,
                publicUrl: tunnelStatus.publicUrl,
            });
        }
        // Initialize and start server
        server = new Server(config, tunnelManager);
        await server.start();
        logger.info('🚀 Tunnels-to-Bots server started successfully', {
            host: config.app.host,
            port: config.app.port,
            wsPath: '/ws',
            metricsPath: config.metrics.path,
        });
        // Setup signal handlers for graceful shutdown
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled rejection:', reason);
        });
    }
    catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Start the server
main();
//# sourceMappingURL=index.js.map