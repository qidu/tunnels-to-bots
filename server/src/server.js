import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory storage
const bots = new Map();
const userBots = new Map();
const sessions = new Map();
const userSessions = new Map();
const tasks = new Map();
const userTasks = new Map();
const connections = new Map();
const serverLogs = [];

// Log buffer (max 200 entries)
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

class TunnelServer {
  constructor(config) {
    this.config = config;
    this.wss = null;
    this.httpServer = null;
    this.heartbeatInterval = null;
  }

  async start() {
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
  }

  async stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) this.wss.close();
    if (this.httpServer) this.httpServer.close();
    log('INFO', 'Server stopped');
  }

  handleHttpRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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
    
    // API: Stats
    if (url.pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStats()));
      return;
    }
    
    // API: Connections
    if (url.pathname === '/api/connections') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getConnections()));
      return;
    }
    
    // API: Bots
    if (url.pathname === '/api/bots') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getBots()));
      return;
    }
    
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  getStats() {
    const connectionsList = this.getConnections();
    return {
      connections: connectionsList,
      sessions: Array.from(sessions.values()).map(s => ({
        ...s,
        connectionCount: s.connectionIds?.size || 0
      })),
      bots: Array.from(bots.values()),
      tasks: Array.from(tasks.values()),
      logs: serverLogs.slice(0, 50)
    };
  }

  getConnections() {
    return Array.from(connections.entries()).map(([id, ws]) => ({
      id,
      userId: ws.userId || null,
      connectedAt: ws.connectedAt || ws.lastActivity,
      lastActivity: ws.lastActivity,
      subscribedBots: Array.from(ws.subscribedBots || [])
    }));
  }

  getBots() {
    return Array.from(bots.values());
  }

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
    try {
      const frame = JSON.parse(data);
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
          this.sendFrame(ws, { type: 'pong', data: { timestamp: Date.now() } });
          break;
        default:
          this.sendError(ws, 400, `Unknown type: ${frame.type}`);
      }
    } catch (e) {
      this.sendError(ws, 400, 'Invalid message');
    }
  }

  handleAuth(ws, frame) {
    ws.userId = frame.data.apiKey?.split('_')[1] || 'user';
    const sessionId = uuidv4();
    
    sessions.set(sessionId, { id: sessionId, userId: ws.userId, connectionIds: new Set([ws.id]), createdAt: new Date().toISOString() });
    userSessions.set(ws.userId, sessionId);

    log('INFO', 'User authenticated', { userId: ws.userId });

    this.sendFrame(ws, {
      type: 'auth_ok',
      data: { userId: ws.userId, sessionId }
    });

    const userBotList = Array.from(userBots.get(ws.userId) || []).map(id => bots.get(id)).filter(Boolean);
    this.sendFrame(ws, { type: 'status', data: { type: 'bots_list', bots: userBotList } });
  }

  handleMessageFrame(ws, frame) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    const { to, text } = frame.data;
    const messageId = uuidv4();

    this.sendFrame(ws, {
      type: 'message',
      data: {
        id: messageId, from: to, to: ws.userId, type: 'text',
        text: text ? `Echo: ${text}` : '', timestamp: new Date().toISOString()
      }
    });

    this.sendFrame(ws, { type: 'message_ack', data: { messageId, status: 'delivered' } });
  }

  handleTask(ws, frame) {
    if (!ws.userId) return this.sendError(ws, 401, 'Not authenticated');
    const { title, description, priority, botId } = frame.data;
    const taskId = uuidv4();

    const task = { id: taskId, userId: ws.userId, botId, title, description, priority, status: 'pending', createdAt: new Date().toISOString() };
    tasks.set(taskId, task);
    
    if (!userTasks.has(ws.userId)) userTasks.set(ws.userId, new Set());
    userTasks.get(ws.userId).add(taskId);

    log('INFO', 'Task created', { taskId, userId: ws.userId });
    this.sendFrame(ws, { type: 'task_status', data: { taskId, status: 'pending' } });
  }

  handleSubscribe(ws, frame) {
    ws.subscribedBots.add(frame.data.botId);
    this.sendFrame(ws, { type: 'status', data: { type: 'subscribed', botId: frame.data.botId } });
  }

  sendFrame(ws, frame) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
  }

  sendError(ws, code, message) {
    this.sendFrame(ws, { type: 'error', data: { code, message } });
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const ws of connections.values()) {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }
    }, this.config.sessions.heartbeat_interval);
  }
}

function registerBot(userId, name, type) {
  const botId = `bot_${uuidv4().slice(0, 8)}`;
  bots.set(botId, { id: botId, userId, name, type, status: 'online', config: {} });
  if (!userBots.has(userId)) userBots.set(userId, new Set());
  userBots.get(userId).add(botId);
  log('INFO', 'Bot registered', { botId, userId, name });
  return bots.get(botId);
}

async function main() {
  const configPath = process.env.CONFIG_PATH || path.join(__dirname, '..', 'config.yaml');
  const config = loadConfig(configPath);
  const server = new TunnelServer(config);
  
  // Register default bots
  registerBot('user', 'Clawra', 'openclaw');
  registerBot('user', 'Helper', 'general');
  registerBot('user', 'Coder', 'development');
  
  await server.start();

  process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
  process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
}

main().catch(err => { log('ERROR', 'Failed to start', { error: err.message }); process.exit(1); });