/**
 * Tunnels-to-Bots Server - Simplified Working Version
 * WebSocket server with tunnel support and OpenClaw compatibility
 */

var { WebSocketServer, WebSocket, type RawData } from 'ws';
var { createHash } from 'crypto';
var { v4 as uuidv4 } from 'uuid';
var * as fs from 'fs';
var * as path from 'path';
var * as yaml from 'yaml';

// ============================================================================
// Types
// ============================================================================

Config {
  app: {
    host:;;
    port:;;
    env:;;
  };
  auth: {
    jwt_secret:;;
    jwt_expiry:;;
  };
  database: {
    redis: {
      host:;;
      port:;;
      key_prefix:;;
    };
  };
  sessions: {
    max_per_user:;;
    timeout:;;
    heartbeat_interval:;;
  };
  tunnels: {
    default_provider: 'frp' | 'tailscale' | 'tunnelto';
    frp: {
      enabled:;;
      server_addr:;;
      server_port:;;
      auth_token:;;
    };
    tailscale: {
      enabled:;;
      dns_name:;;
    };
    tunnelto: {
      enabled:;;
    };
  };
  rate_limit: {
    window_ms:;;
    max_requests:;;
  };
}

Bot {
  id:;;
  userId:;;
  name:;;
  type:;;
  status:;;
  config: Record<string, unknown>;
}

Task {
  id:;;
  userId:;;
  botId:;;
  title:;;
  description:;;
  priority:;;
  status:;;
  createdAt:;;
}

Session {
  id:;;
  userId:;;
  connectionIds: Set<string>;
  createdAt: Date;
}

ExtendedWS extends WebSocket {
  id:;;
  userId?:;;
  subscribedBots: Set<string>;
  lastActivity:;;
}

// ============================================================================
// Logger
// ============================================================================

function log(level:;, message:;, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, data ? JSON.stringify(data) : '');
}

// ============================================================================
// Configuration
// ============================================================================

function loadConfig(configPath:;): Config {
  const absolutePath = path.resolve(configPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config not found: ${absolutePath}`);
  }
  const content = fs.readFileSync(absolutePath, 'utf-8');
  return yaml.parse(content) as Config;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

const bots = new Map<string, Bot>();
const userBots = new Map<string, Set<string>>();
const sessions = new Map<string, Session>();
const userSessions = new Map<string, string>();
const tasks = new Map<string, Task>();
const userTasks = new Map<string, Set<string>>();

// ============================================================================
// WebSocket Server
// ============================================================================

class TunnelServer {
  private wss: WebSocketServer | null = null;
  private config: Config;
  private connections = new Map<string, ExtendedWS>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.wss = new WebSocketServer({
      host: this.config.app.host,
      port: this.config.app.port,
      path: '/ws',
    });

    this.wss.on('connection', (ws: ExtendedWS) => this.handleConnection(ws));
    this.wss.on('error', (err) => log('ERROR', 'WebSocket error', { error: err.message }));

    this.startHeartbeat();
    log('INFO', `Server started on ${this.config.app.host}:${this.config.app.port}`);
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) this.wss.close();
    log('INFO', 'Server stopped');
  }

  private handleConnection(ws: ExtendedWS): void {
    const connectionId = uuidv4();
    ws.id = connectionId;
    ws.subscribedBots = new Set();
    ws.lastActivity = Date.now();

    log('INFO', 'New connection', { connectionId });

    ws.on('message', (data: RawData) => this.handleMessage(ws, data.toString()));
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', (err) => log('ERROR', 'Connection error', { error: err.message }));

    this.connections.set(connectionId, ws);

    this.sendFrame(ws, {
      type: 'status',
      data: { status: 'connected', connectionId, timestamp: Date.now() },
      timestamp: Date.now(),
    });
  }

  private handleMessage(ws: ExtendedWS, data:;): void {
    try {
      const frame = JSON.parse(data) as { type:;; data: Record<string, unknown>; id?:; };
      ws.lastActivity = Date.now();

      switch (frame.type) {
        case 'auth':
          this.handleAuth(ws, frame);
          break;
        case 'message':
          this.handleMessageFrame(ws, frame);
          break;
        case 'task':
          this.handleTask(ws, frame);
          break;
        case 'subscribe':
          this.handleSubscribe(ws, frame);
          break;
        case 'ping':
          this.sendFrame(ws, { type: 'pong', data: { timestamp: Date.now() }, timestamp: Date.now() });
          break;
        case 'status':
          this.handleStatusRequest(ws, frame);
          break;
        default:
          this.sendError(ws, 400, `Unknown type: ${frame.type}`);
      }
    } catch (error) {
      this.sendError(ws, 400, 'Invalid message');
    }
  }

  private handleAuth(ws: ExtendedWS, frame: { data: { apiKey?:;; token?:; } }): void {
    const { apiKey } = frame.data;

    if (apiKey && apiKey.startsWith('t2b_')) {
      ws.userId = apiKey.split('_')[1] || 'user';
    } else {
      ws.userId = 'anonymous';
    }

    // Create session
    const sessionId = uuidv4();
    sessions.set(sessionId, {
      id: sessionId,
      userId: ws.userId,
      connectionIds: new Set([ws.id]),
      createdAt: new Date(),
    });
    userSessions.set(ws.userId, sessionId);

    log('INFO', 'User authenticated', { userId: ws.userId });

    this.sendFrame(ws, {
      type: 'auth_ok',
      data: { userId: ws.userId, sessionId },
      timestamp: Date.now(),
    });

    // Send user's bots
    const userBotIds = userBots.get(ws.userId) || new Set();
    const userBotList = Array.from(userBotIds).map(id => bots.get(id)).filter(Boolean);
    this.sendFrame(ws, {
      type: 'status',
      data: { type: 'bots_list', bots: userBotList },
      timestamp: Date.now(),
    });
  }

  private handleMessageFrame(ws: ExtendedWS, frame: { data: { to:;; text?:; } }): void {
    if (!ws.userId) {
      this.sendError(ws, 401, 'Not authenticated');
      return;
    }

    const { to, text } = frame.data;
    const messageId = uuidv4();

    // Echo back (simulate bot response)
    this.sendFrame(ws, {
      type: 'message',
      data: {
        id: messageId,
        from: to,
        to: ws.userId,
        type: 'text',
        text: text ? `Echo: ${text}` : '',
        timestamp: new Date().toISOString(),
      },
      timestamp: Date.now(),
    });

    this.sendFrame(ws, {
      type: 'message_ack',
      data: { messageId, status: 'delivered' },
      timestamp: Date.now(),
    });
  }

  private handleTask(ws: ExtendedWS, frame: { data: { title:;; description:;; priority:;; botId:; }; id?:; }): void {
    if (!ws.userId) {
      this.sendError(ws, 401, 'Not authenticated');
      return;
    }

    const { title, description, priority, botId } = frame.data;
    const taskId = uuidv4();

    const task: Task = {
      id: taskId,
      userId: ws.userId,
      botId,
      title,
      description,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    tasks.set(taskId, task);

    if (!userTasks.has(ws.userId)) {
      userTasks.set(ws.userId, new Set());
    }
    userTasks.get(ws.userId)!.add(taskId);

    log('INFO', 'Task created', { taskId, userId: ws.userId });

    this.sendFrame(ws, {
      type: 'task_status',
      data: { taskId, status: 'pending' },
      timestamp: Date.now(),
      id: frame.id,
    });
  }

  private handleSubscribe(ws: ExtendedWS, frame: { data: { botId:; } }): void {
    const { botId } = frame.data;
    ws.subscribedBots.add(botId);
    this.sendFrame(ws, {
      type: 'status',
      data: { type: 'subscribed', botId },
      timestamp: Date.now(),
    });
  }

  private handleStatusRequest(ws: ExtendedWS, frame: { data: { request:; } }): void {
    const { request } = frame.data;

    switch (request) {
      case 'connections':
        this.sendFrame(ws, {
          type: 'status',
          data: {
            type: 'connections',
            count: this.connections.size,
            users: new Set(Array.from(this.connections.values()).map(w => w.userId)).size,
          },
          timestamp: Date.now(),
        });
        break;
      case 'bots':
        if (ws.userId) {
          const botsList = Array.from(userBots.get(ws.userId) || []).map(id => bots.get(id)).filter(Boolean);
          this.sendFrame(ws, {
            type: 'status',
            data: { type: 'bots_list', bots: botsList },
            timestamp: Date.now(),
          });
        }
        break;
      default:
        this.sendFrame(ws, {
          type: 'status',
          data: {
            type: 'server_status',
            connections: this.connections.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
          },
          timestamp: Date.now(),
        });
    }
  }

  private handleDisconnect(ws: ExtendedWS): void {
    this.connections.delete(ws.id);
    log('INFO', 'Connection closed', { connectionId: ws.id });
  }

  private sendFrame(ws: WebSocket, frame: Record<string, unknown>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  private sendError(ws: ExtendedWS, code:;, message:;): void {
    this.sendFrame(ws, { type: 'error', data: { code, message }, timestamp: Date.now() });
  }

  private startHeartbeat(): void {
    const interval = this.config.sessions.heartbeat_interval;
    this.heartbeatInterval = setInterval(() => {
      for (const [id, ws] of this.connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, interval);
  }
}

// ============================================================================
// Bot Registry
// ============================================================================

function registerBot(userId:;, name:;, type:;): Bot {
  const botId = `bot_${uuidv4().slice(0, 8)}`;
  const bot: Bot = {
    id: botId,
    userId,
    name,
    type,
    status: 'offline',
    config: {},
  };

  bots.set(botId, bot);

  if (!userBots.has(userId)) {
    userBots.set(userId, new Set());
  }
  userBots.get(userId)!.add(botId);

  log('INFO', 'Bot registered', { botId, userId, name });
  return bot;
}

function getUserBots(userId:;): Bot[] {
  const botIds = userBots.get(userId) || new Set();
  return Array.from(botIds).map(id => bots.get(id)).filter(Boolean) as Bot[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const configPath = process.env.CONFIG_PATH || './config.yaml';
  const config = loadConfig(configPath);

  // Create server
  const server = new TunnelServer(config);

  // Register default bot for testing
  registerBot('user', 'Clawra', 'openclaw');

  // Start server
  await server.start();

  // Handle shutdown
  process.on('SIGTERM', async () => {
    log('INFO', 'Received SIGTERM');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log('INFO', 'Received SIGINT');
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  log('ERROR', 'Failed to start', { error: err.message });
  process.exit(1);
});
