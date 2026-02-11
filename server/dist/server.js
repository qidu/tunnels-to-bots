/**
 * WebSocket Server
 * Main WebSocket server with connection handling, authentication, and message routing
 */
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager } from './session-manager.js';
import { MessageRouter } from './message-router.js';
import { AuthService } from './services/auth-service.js';
import { BotRegistry } from './bot-registry.js';
import { logger, createChildLogger } from './utils/logger.js';
export class Server {
    wss = null;
    config;
    tunnelManager;
    sessionManager;
    messageRouter;
    authService;
    botRegistry;
    connections = new Map();
    heartbeatInterval = null;
    requestCounter = 0;
    constructor(config, tunnelManager) {
        this.config = config;
        this.tunnelManager = tunnelManager;
        this.sessionManager = new SessionManager(config.sessions);
        this.messageRouter = new MessageRouter();
        this.authService = new AuthService(config.auth);
        this.botRegistry = new BotRegistry();
    }
    /**
     * Start the WebSocket server
     */
    async start() {
        const log = createChildLogger({ component: 'server' });
        // Create WebSocket server
        this.wss = new WebSocketServer({
            host: this.config.app.host,
            port: this.config.app.port,
            path: '/ws',
        });
        // Setup connection handler
        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
        // Setup error handler
        this.wss.on('error', (error) => {
            log.error('WebSocket server error:', error);
        });
        // Start heartbeat monitoring
        this.startHeartbeat();
        // Setup rate limiting per connection
        this.setupRateLimiting();
        log.info('WebSocket server started', {
            host: this.config.app.host,
            port: this.config.app.port,
            path: '/ws',
        });
    }
    /**
     * Stop the WebSocket server
     */
    async stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        // Close all connections
        for (const [id, ws] of this.connections) {
            this.sendError(ws, 1001, 'Server shutting down');
            ws.close(1001, 'Server shutting down');
        }
        this.connections.clear();
        // Close server
        if (this.wss) {
            await new Promise((resolve) => {
                this.wss.close(() => resolve());
            });
        }
        logger.info('WebSocket server stopped');
    }
    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws, req) {
        const log = createChildLogger({ component: 'connection' });
        const connectionId = uuidv4();
        // Initialize extended WebSocket properties
        ws.id = connectionId;
        ws.connectionId = connectionId;
        ws.subscribedBots = new Set();
        ws.lastActivity = Date.now();
        // Parse client info from headers
        ws.deviceInfo = this.parseDeviceInfo(req);
        log.info('New connection', {
            connectionId,
            userAgent: req.headers['user-agent'],
        });
        // Handle incoming messages
        ws.on('message', (data) => {
            this.handleMessage(ws, data);
        });
        // Handle close
        ws.on('close', (code, reason) => {
            this.handleDisconnect(ws, code, reason.toString());
        });
        // Handle errors
        ws.on('error', (error) => {
            log.error('Connection error:', { connectionId, error: error.message });
        });
        // Store connection
        this.connections.set(connectionId, ws);
        // Send connection acknowledgment
        this.sendFrame(ws, {
            type: 'status',
            data: {
                status: 'connected',
                connectionId,
                serverVersion: '1.0.0',
                timestamp: Date.now(),
            },
            timestamp: Date.now(),
        });
    }
    /**
     * Handle incoming message
     */
    handleMessage(ws, data) {
        const log = createChildLogger({ component: 'message', connectionId: ws.connectionId });
        try {
            // Parse frame
            const rawFrame = JSON.parse(data.toString());
            ws.lastActivity = Date.now();
            log.debug('Received frame', { type: rawFrame.type });
            // Route frame based on type
            switch (rawFrame.type) {
                case 'auth':
                    this.handleAuth(ws, rawFrame);
                    break;
                case 'message':
                    this.handleMessageFrame(ws, rawFrame);
                    break;
                case 'ping':
                    this.sendFrame(ws, {
                        type: 'pong',
                        data: { timestamp: Date.now() },
                        timestamp: Date.now(),
                    });
                    break;
                case 'subscribe':
                    this.handleSubscribe(ws, rawFrame);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscribe(ws, rawFrame);
                    break;
                case 'task':
                    this.handleTask(ws, rawFrame);
                    break;
                case 'status':
                    this.handleStatusRequest(ws, rawFrame);
                    break;
                default:
                    this.sendError(ws, 400, `Unknown frame type: ${rawFrame.type}`);
            }
        }
        catch (error) {
            log.error('Failed to parse message:', { error: error.message });
            this.sendError(ws, 400, 'Invalid message format');
        }
    }
    /**
     * Handle authentication frame
     */
    async handleAuth(ws, frame) {
        const log = createChildLogger({ component: 'auth', connectionId: ws.connectionId });
        try {
            const { apiKey, token, userId } = frame.data;
            // Validate credentials
            if (apiKey) {
                const authResult = await this.authService.validateApiKey(apiKey);
                if (!authResult.valid || !authResult.userId) {
                    this.sendFrame(ws, {
                        type: 'auth_error',
                        data: { message: 'Invalid API key' },
                        timestamp: Date.now(),
                        id: frame.id,
                    });
                    return;
                }
                ws.userId = authResult.userId;
            }
            else if (token) {
                const payload = this.authService.validateToken(token);
                if (!payload) {
                    this.sendFrame(ws, {
                        type: 'auth_error',
                        data: { message: 'Invalid token' },
                        timestamp: Date.now(),
                        id: frame.id,
                    });
                    return;
                }
                ws.userId = payload.userId;
            }
            else {
                this.sendFrame(ws, {
                    type: 'auth_error',
                    data: { message: 'Authentication required' },
                    timestamp: Date.now(),
                    id: frame.id,
                });
                return;
            }
            // Check session limits
            const userConnections = this.getUserConnections(ws.userId);
            if (userConnections.length >= this.config.sessions.max_per_user) {
                this.sendFrame(ws, {
                    type: 'auth_error',
                    data: { message: 'Maximum concurrent sessions reached' },
                    timestamp: Date.now(),
                    id: frame.id,
                });
                return;
            }
            // Create session
            await this.sessionManager.createSession(ws.connectionId, ws.userId);
            log.info('User authenticated', { userId: ws.userId });
            // Send success
            this.sendFrame(ws, {
                type: 'auth_ok',
                data: {
                    userId: ws.userId,
                    sessionId: ws.connectionId,
                    expiresIn: this.config.auth.jwt_expiry,
                },
                timestamp: Date.now(),
                id: frame.id,
            });
            // Notify about subscribed bots
            const userBots = this.botRegistry.getUserBots(ws.userId);
            if (userBots.length > 0) {
                this.sendFrame(ws, {
                    type: 'status',
                    data: { type: 'bots_list', bots: userBots },
                    timestamp: Date.now(),
                });
            }
        }
        catch (error) {
            log.error('Auth error:', { error: error.message });
            this.sendFrame(ws, {
                type: 'auth_error',
                data: { message: 'Authentication failed' },
                timestamp: Date.now(),
                id: frame.id,
            });
        }
    }
    /**
     * Handle chat message frame
     */
    handleMessageFrame(ws, frame) {
        if (!ws.userId) {
            this.sendError(ws, 401, 'Not authenticated');
            return;
        }
        const messageData = frame.data;
        // Route to appropriate bot
        this.messageRouter.route(ws, {
            from: ws.userId,
            to: messageData.to,
            text: messageData.text,
            botId: messageData.botId,
            channel: messageData.channel,
            replyTo: messageData.replyTo,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Handle subscribe to bot
     */
    handleSubscribe(ws, frame) {
        if (!ws.userId) {
            this.sendError(ws, 401, 'Not authenticated');
            return;
        }
        const { botId } = frame.data;
        // Verify bot belongs to user
        const bot = this.botRegistry.getBot(botId);
        if (!bot || bot.userId !== ws.userId) {
            this.sendError(ws, 403, 'Bot not found or access denied');
            return;
        }
        ws.subscribedBots.add(botId);
        this.sendFrame(ws, {
            type: 'status',
            data: { type: 'subscribed', botId },
            timestamp: Date.now(),
            id: frame.id,
        });
    }
    /**
     * Handle unsubscribe from bot
     */
    handleUnsubscribe(ws, frame) {
        const { botId } = frame.data;
        ws.subscribedBots.delete(botId);
        this.sendFrame(ws, {
            type: 'status',
            data: { type: 'unsubscribed', botId },
            timestamp: Date.now(),
            id: frame.id,
        });
    }
    /**
     * Handle task assignment frame
     */
    handleTask(ws, frame) {
        if (!ws.userId) {
            this.sendError(ws, 401, 'Not authenticated');
            return;
        }
        const taskData = frame.data;
        // Create task
        const task = this.sessionManager.createTask({
            userId: ws.userId,
            botId: taskData.botId,
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            dueDate: taskData.dueDate,
        });
        this.sendFrame(ws, {
            type: 'task_status',
            data: { taskId: task.id, status: 'pending' },
            timestamp: Date.now(),
            id: frame.id,
        });
    }
    /**
     * Handle status request
     */
    handleStatusRequest(ws, frame) {
        const { request } = frame.data;
        switch (request) {
            case 'connections':
                this.sendFrame(ws, {
                    type: 'status',
                    data: {
                        type: 'connections',
                        count: this.connections.size,
                        userCount: this.getUniqueUserCount(),
                    },
                    timestamp: Date.now(),
                    id: frame.id,
                });
                break;
            case 'bots':
                if (ws.userId) {
                    const bots = this.botRegistry.getUserBots(ws.userId);
                    this.sendFrame(ws, {
                        type: 'status',
                        data: { type: 'bots_list', bots },
                        timestamp: Date.now(),
                        id: frame.id,
                    });
                }
                break;
            case 'full':
            default:
                this.sendFrame(ws, {
                    type: 'status',
                    data: {
                        type: 'server_status',
                        connections: this.connections.size,
                        users: this.getUniqueUserCount(),
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                    },
                    timestamp: Date.now(),
                    id: frame.id,
                });
        }
    }
    /**
     * Handle disconnect
     */
    handleDisconnect(ws, code, reason) {
        const log = createChildLogger({ component: 'connection', connectionId: ws.connectionId });
        // Cleanup session
        this.sessionManager.endSession(ws.connectionId);
        // Remove from connections
        this.connections.delete(ws.connectionId);
        log.info('Connection closed', { code, reason });
        // Notify subscribed bots
        for (const botId of ws.subscribedBots) {
            this.botRegistry.updateBotStatus(botId, 'offline');
        }
    }
    /**
     * Send frame to client
     */
    sendFrame(ws, frame) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(frame));
        }
    }
    /**
     * Send error to client
     */
    sendError(ws, code, message) {
        this.sendFrame(ws, {
            type: 'error',
            data: { code, message },
            timestamp: Date.now(),
        });
    }
    /**
     * Broadcast frame to all connections
     */
    broadcast(frame) {
        const message = JSON.stringify(frame);
        for (const ws of this.connections.values()) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }
    /**
     * Send to specific user
     */
    sendToUser(userId, frame) {
        const message = JSON.stringify(frame);
        for (const ws of this.connections.values()) {
            if (ws.userId === userId && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }
    /**
     * Get all connections for a user
     */
    getUserConnections(userId) {
        const connections = [];
        for (const ws of this.connections.values()) {
            if (ws.userId === userId) {
                connections.push(ws);
            }
        }
        return connections;
    }
    /**
     * Get unique user count
     */
    getUniqueUserCount() {
        const users = new Set();
        for (const ws of this.connections.values()) {
            if (ws.userId) {
                users.add(ws.userId);
            }
        }
        return users.size;
    }
    /**
     * Start heartbeat monitoring
     */
    startHeartbeat() {
        const heartbeatInterval = this.config.sessions.heartbeat_interval;
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeout = this.config.sessions.timeout * 1000;
            for (const [id, ws] of this.connections) {
                // Check for stale connections
                if (now - ws.lastActivity > timeout) {
                    this.sendFrame(ws, {
                        type: 'status',
                        data: { type: 'timeout' },
                        timestamp: now,
                    });
                    ws.close(4000, 'Connection timeout');
                    continue;
                }
                // Send ping
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }
        }, heartbeatInterval);
    }
    /**
     * Setup rate limiting
     */
    setupRateLimiting() {
        // Basic rate limiting implementation
        const rateLimitWindow = this.config.rate_limit.window_ms;
        const maxMessages = this.config.rate_limit.max_messages_per_second;
        // This would be more sophisticated in production
        // Using a simple token bucket per connection
    }
    /**
     * Parse device info from request
     */
    parseDeviceInfo(req) {
        const userAgent = req.headers['user-agent'] || '';
        let platform = 'other';
        if (userAgent.includes('Android')) {
            platform = 'android';
        }
        else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            platform = 'ios';
        }
        else if (userAgent.includes('Mozilla')) {
            platform = 'web';
        }
        return {
            platform,
            userAgent,
            ip: req.socket.remoteAddress,
            connectedAt: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=server.js.map