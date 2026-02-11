/**
 * WebSocket Server
 * Main WebSocket server with connection handling, authentication, and message routing
 */
import type { ServerConfig, WSFrame } from './types.js';
import { TunnelManager } from './tunnel-manager.js';
export declare class Server {
    private wss;
    private config;
    private tunnelManager;
    private sessionManager;
    private messageRouter;
    private authService;
    private botRegistry;
    private connections;
    private heartbeatInterval;
    private requestCounter;
    constructor(config: ServerConfig, tunnelManager: TunnelManager);
    /**
     * Start the WebSocket server
     */
    start(): Promise<void>;
    /**
     * Stop the WebSocket server
     */
    stop(): Promise<void>;
    /**
     * Handle new WebSocket connection
     */
    private handleConnection;
    /**
     * Handle incoming message
     */
    private handleMessage;
    /**
     * Handle authentication frame
     */
    private handleAuth;
    /**
     * Handle chat message frame
     */
    private handleMessageFrame;
    /**
     * Handle subscribe to bot
     */
    private handleSubscribe;
    /**
     * Handle unsubscribe from bot
     */
    private handleUnsubscribe;
    /**
     * Handle task assignment frame
     */
    private handleTask;
    /**
     * Handle status request
     */
    private handleStatusRequest;
    /**
     * Handle disconnect
     */
    private handleDisconnect;
    /**
     * Send frame to client
     */
    private sendFrame;
    /**
     * Send error to client
     */
    private sendError;
    /**
     * Broadcast frame to all connections
     */
    broadcast(frame: WSFrame): void;
    /**
     * Send to specific user
     */
    sendToUser(userId: string, frame: WSFrame): void;
    /**
     * Get all connections for a user
     */
    private getUserConnections;
    /**
     * Get unique user count
     */
    private getUniqueUserCount;
    /**
     * Start heartbeat monitoring
     */
    private startHeartbeat;
    /**
     * Setup rate limiting
     */
    private setupRateLimiting;
    /**
     * Parse device info from request
     */
    private parseDeviceInfo;
}
//# sourceMappingURL=server.d.ts.map