/**
 * Tunnels-to-Bots Server - SECURE VERSION
 * 
 * Security Features:
 * - User isolation (users can only access their own data)
 * - Bot ownership verification
 * - Secure API key validation
 * - Rate limiting
 * - Input sanitization
 * - Dashboard authentication
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createHash, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// STORAGE - Using per-user isolation maps
// ============================================================================

// User registry: userId -> { apiKeyHash, createdAt }
const users = new Map();

// Per-user data stores (user isolation)
const userData = new Map();  // userId -> { bots, sessions, tasks, connections }

// Global references for quick lookup (read-only, for validation)
const bots = new Map();
const sessions = new Map();
const tasks = new Map();
const connections = new Map();
const serverLogs = [];

// Rate limiting
const rateLimit = new Map();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(level, message, data) {
  const entry = { timestamp: new Date().toISOString(), level, message, data };
  serverLogs.unshift(entry);
  if (serverLogs.length > 200) serverLogs.pop();
  console.log(`[${entry.timestamp}] [${level}] ${message}`, data ? JSON.stringify(data) : '');
}

function loadConfig(configPath) {
  const content = fs.readFileSync(path.resolve(configPath), 'utf-8');
  return yaml.parse(content);
}

// Secure API key validation
function validateApiKey(apiKey, secret) {
  if (!apiKey || typeof apiKey !== 'string') return null;
  
  // Format: t2b_<userId>_<signature>
  const parts = apiKey.split('_');
  if (parts.length !== 3 || parts[0] !== 't2b') return null;
  
  const [prefix, userId, signature] = parts;
  if (!userId || !signature) return null;
  
  // Verify signature
  const expectedSig = createHash('sha256')
    .update(`${userId}:${secret}`)
    .digest('hex')
    .substring(0, 16);
  
  if (signature.length !== 16) return null;
  
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
  } catch {
    return null;
  }
  
  return userId;
}

// Generate secure API key
function generateApiKey(userId, secret) {
  const signature = createHash('sha256')
    .update(`${userId}:${secret}`)
    .digest('hex')
    .substring(0, 16);
  return `t2b_${userId}_${signature}`;
}

// Rate limiter
function checkRateLimit(userId, action, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const key = `${userId}:${action}`;
  const record = rateLimit.get(key) || { count: 0, windowStart: now };
  
  if (now - record.windowStart > windowMs) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }
  
  rateLimit.set(key, record);
  return record.count <= maxRequests;
}

// Sanitize input
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '')  // Remove potential HTML
    .replace(/[\x00-\x1f\x7f]/g, '')  // Remove control chars
    .substring(0, 4096);  // Limit length
}

// User data initialization
function getUserData(userId) {
  if (!userData.has(userId)) {
    userData.set(userId, {
      bots: new Map(),
      sessions: new Set(),
      tasks: new Set(),
      connections: new Set()
    });
  }
  return userData.get(userId);
}

// Verify bot ownership
function verifyBotOwnership(userId, botId) {
  const userBotData = getUserData(userId);
  const bot = bots.get(botId);
  
  // Bot must exist and belong to this user
  if (!bot) return false;
  if (bot.userId !== userId) return false;
  
  // Also verify in user's bot list
  if (!userBotData.bots.has(botId)) return false;
  
  return true;
}

// ============================================================================
// MAIN SERVER CLASS
// ============================================================================

class TunnelServer {
  constructor(config) {
    this.config = config;
    this.authSecret = config.auth?.api_secret || 'default-secret-change-me';
    this.wss = null;
    this.httpServer = null;
    this.heartbeatInterval = null;
    this.dashboardSecret = config.auth?.dashboard_secret || 'dashboard-secret-change-me';
  }

  async start() {
    // Initialize default user for demo
    const demoUserId = 'demo';
    users.set(demoUserId, { 
      apiKey: generateApiKey(demoUserId, this.authSecret),
      createdAt: new Date().toISOString() 
    });
    
    // Create demo user's data
    const demoData = getUserData(demoUserId);
    this.registerBot(demoUserId, 'Clawra', 'openclaw');
    this.registerBot(demoUserId, 'Helper', 'general');
    this.registerBot(demoUserId, 'Coder', 'development');

    // WebSocket Server
    this.wss = new WebSocketServer({
      host: this.config.app.host,
      port: this.config.app.port,
      path: '/ws'
    });

    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (err) => log('ERROR', 'WebSocket error', { error: err.message }));

    // HTTP Server for Dashboard
    this.httpServer = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    const dashboardPort = this.config.app.dashboard_port || 3001;
    this.httpServer.listen(dashboardPort, () => {
      log('INFO', `Dashboard available at http://${this.config.app.host}:${dashboardPort}`);
    });

    this.startHeartbeat();
    log('INFO', `Server started on ${this.config.app.host}:${this.config.app.port}`);
    log('INFO', `Demo API key: ${users.get(demoUserId).apiKey}`);
  }

  async stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) this.wss.close();
    if (this.httpServer) this.httpServer.close();
    log('INFO', 'Server stopped');
  }

  // =========================================================================
  // HTTP HANDLERS (Dashboard)
  // =========================================================================

  handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // CORS - restrict in production
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Dashboard static files
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const htmlPath = path.join(__dirname, 'dashboard', 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(htmlPath));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Dashboard not found');
      }
      return;
    }
    
    // Dashboard authentication
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${this.dashboardSecret}`) {
      // Allow local connections without auth for development
      const isLocal = req.socket.remoteAddress === '127.0.0.1' || 
                      req.socket.remoteAddress === '::1' ||
                      req.socket.remoteAddress === '::ffff:127.0.0.1';
      
      if (!isLocal) {
        res.writeHead(401, { 'WWW-Authenticate': 'Bearer' });
        res.end('Unauthorized - Dashboard requires authentication');
        return;
      }
    }
    
    // API: Stats (aggregated, no user data)
    if (url.pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        server: {
          connections: connections.size,
          sessions: sessions.size,
          bots: bots.size,
          tasks: tasks.size,
          uptime: process.uptime()
        },
        logs: serverLogs.slice(0, 50)
      }));
      return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  // =========================================================================
  // WEBSOCKET HANDLERS
  // =========================================================================

  handleConnection(ws) {
    const connectionId = uuidv4();
    ws.id = connectionId;
    ws.connectedAt = Date.now();
    ws.subscribedBots = new Set();
    ws.lastActivity = Date.now();
    ws.userId = null;

    log('INFO', 'New connection', { connectionId });
    connections.set(connectionId, ws);

    ws.on('message', (data) => this.handleMessage(ws, data.toString()));
    ws.on('close', () => {
      if (ws.userId) {
        const userData = getUserData(ws.userId);
        userData.connections.delete(connectionId);
      }
      connections.delete(connectionId);
      log('INFO', 'Connection closed', { connectionId });
    });
    ws.on('error', (err) => log('ERROR', 'Connection error', { error: err.message }));

    this.sendFrame(ws, {
      type: 'status',
      data: { status: 'connected', connectionId, timestamp: Date.now() }
    });
  }

  handleMessage(ws, data) {
    // Rate limit check
    const clientIp = 'unknown'; // Could extract from ws._socket
    
    try {
      const frame = JSON.parse(data);
      ws.lastActivity = Date.now();

      switch (frame.type) {
        case 'auth':
          this.handleAuth(ws, frame);
          break;
        case 'message':
          if (!checkRateLimit(ws.userId, 'messages')) {
            this.sendError(ws, 429, 'Rate limit exceeded');
            return;
          }
          this.handleMessageFrame(ws, frame);
          break;
        case 'task':
          this.handleTask(ws, frame);
          break;
        case 'subscribe':
          this.handleSubscribe(ws, frame);
          break;
        case 'list_bots':
          this.handleListBots(ws);
          break;
        case 'ping':
          this.sendFrame(ws, { type: 'pong', data: { timestamp: Date.now() } });
          break;
        default:
          this.sendError(ws, 400, `Unknown type: ${frame.type}`);
      }
    } catch (e) {
      this.sendError(ws, 400, 'Invalid message format');
    }
  }

  handleAuth(ws, frame) {
    const apiKey = frame.data?.apiKey || frame.data?.token;
    const userId = validateApiKey(apiKey, this.authSecret);
    
    if (!userId) {
      log('WARN', 'Authentication failed', { 
        reason: 'Invalid API key',
        keyPrefix: apiKey?.substring(0, 10) 
      });
      this.sendError(ws, 401, 'Invalid API key');
      return;
    }
    
    ws.userId = userId;
    
    // Track connection for this user
    const userData = getUserData(userId);
    userData.connections.add(ws.id);
    
    // Create session
    const sessionId = uuidv4();
    const session = { 
      id: sessionId, 
      userId, 
      createdAt: new Date().toISOString(),
      lastActivity: Date.now()
    };
    sessions.set(sessionId, session);
    userData.sessions.add(sessionId);

    log('INFO', 'User authenticated', { userId, sessionId });

    this.sendFrame(ws, {
      type: 'auth_ok',
      data: { 
        userId, 
        sessionId,
        botCount: userData.bots.size
      }
    });

    // Send only THIS user's bots
    const userBotList = Array.from(userData.bots.values());
    this.sendFrame(ws, { type: 'status', data: { type: 'bots_list', bots: userBotList } });
  }

  handleMessageFrame(ws, frame) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    
    const { to: botId, text } = frame.data || {};
    
    if (!botId) {
      return this.sendError(ws, 400, 'Missing bot ID');
    }
    
    // SECURITY: Verify bot ownership
    if (!verifyBotOwnership(ws.userId, botId)) {
      log('WARN', 'Unauthorized message attempt', { 
        userId: ws.userId, 
        botId,
        connectionId: ws.id 
      });
      this.sendError(ws, 403, 'Bot not found or access denied');
      return;
    }

    const messageId = uuidv4();
    const sanitizedText = sanitize(text);

    // Echo back to sender (in production, this would route to actual bot)
    this.sendFrame(ws, {
      type: 'message',
      data: {
        id: messageId,
        from: botId,
        to: ws.userId,
        type: 'text',
        text: sanitizedText ? `Echo: ${sanitizedText}` : '',
        timestamp: new Date().toISOString()
      }
    });

    this.sendFrame(ws, { type: 'message_ack', data: { messageId, status: 'delivered' } });
  }

  handleTask(ws, frame) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    
    const { title, description, priority, botId } = frame.data || {};
    
    if (!botId) {
      return this.sendError(ws, 400, 'Missing bot ID');
    }
    
    // SECURITY: Verify bot ownership
    if (!verifyBotOwnership(ws.userId, botId)) {
      this.sendError(ws, 403, 'Bot not found or access denied');
      return;
    }

    const taskId = uuidv4();
    const task = { 
      id: taskId, 
      userId: ws.userId, 
      botId, 
      title: sanitize(title), 
      description: sanitize(description), 
      priority: sanitize(priority) || 'medium', 
      status: 'pending', 
      createdAt: new Date().toISOString() 
    };
    
    tasks.set(taskId, task);
    
    const userData = getUserData(ws.userId);
    userData.tasks.add(taskId);

    log('INFO', 'Task created', { taskId, userId: ws.userId, botId });
    this.sendFrame(ws, { type: 'task_status', data: { taskId, status: 'pending' } });
  }

  handleSubscribe(ws, frame) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    
    const { botId } = frame.data || {};
    
    if (!botId) {
      return this.sendError(ws, 400, 'Missing bot ID');
    }
    
    // SECURITY: Verify bot ownership
    if (!verifyBotOwnership(ws.userId, botId)) {
      this.sendError(ws, 403, 'Bot not found or access denied');
      return;
    }
    
    ws.subscribedBots.add(botId);
    this.sendFrame(ws, { type: 'status', data: { type: 'subscribed', botId } });
  }

  handleListBots(ws) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    
    const userData = getUserData(ws.userId);
    const botList = Array.from(userData.bots.values());
    
    this.sendFrame(ws, { 
      type: 'status', 
      data: { type: 'bots_list', bots: botList } 
    });
  }

  // Register bot for a specific user
  registerBot(userId, name, type) {
    const botId = `bot_${uuidv4().slice(0, 8)}`;
    const bot = { 
      id: botId, 
      userId, 
      name: sanitize(name), 
      type: sanitize(type), 
      status: 'online', 
      config: {},
      createdAt: new Date().toISOString()
    };
    
    bots.set(botId, bot);
    
    const userData = getUserData(userId);
    userData.bots.set(botId, bot);
    
    log('INFO', 'Bot registered', { botId, userId, name });
    return bot;
  }

  sendFrame(ws, frame) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  sendError(ws, code, message) {
    this.sendFrame(ws, { type: 'error', data: { code, message } });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const ws of connections.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }
    }, this.config.sessions?.heartbeat_interval || 30000);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.yaml');
  const config = loadConfig(configPath);
  
  // Security: Warn if using default secrets
  if (!config.auth?.api_secret || config.auth.api_secret === 'default-secret-change-me') {
    log('WARN', 'Using default API secret - CHANGE IN PRODUCTION');
  }
  if (!config.auth?.dashboard_secret || config.auth.dashboard_secret === 'dashboard-secret-change-me') {
    log('WARN', 'Using default dashboard secret - CHANGE IN PRODUCTION');
  }
  
  const server = new TunnelServer(config);
  await server.start();

  process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
}

main().catch(err => { 
  log('ERROR', 'Failed to start', { error: err.message }); 
  process.exit(1); 
});