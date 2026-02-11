#!/usr/bin/env node
/**
 * Tunnels-to-Bots Web Demo - Node.js Backend Server
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

const PORT = process.env.PORT || 3001;

// In-memory storage
const bots = new Map();
const userBots = new Map();
const tasks = new Map();

// Load config
function loadConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'config.yaml');
    if (fs.existsSync(configPath)) {
      return yaml.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {}
  return {
    app: { host: '0.0.0.0', port: PORT, env: 'development' },
    auth: { jwt_secret: 'demo-secret' },
    sessions: { max_per_user: 10, timeout: 3600, heartbeat_interval: 30000 },
    tunnels: { default_provider: 'demo' },
    rate_limit: { window_ms: 60000, max_requests: 100 }
  };
}

const config = loadConfig();
const connections = new Map();

// Demo bots
const demoBots = [
  { id: 'bot_clawra', name: 'Clawra', type: 'openclaw', status: 'online', description: 'Your AI assistant' },
  { id: 'bot_helper', name: 'Helper', type: 'custom', status: 'online', description: 'General helper' },
  { id: 'bot_coder', name: 'Coder', type: 'openclaw', status: 'online', description: 'Code assistant' }
];

demoBots.forEach(bot => bots.set(bot.id, bot));

// WebSocket server
const wss = new WebSocketServer({
  host: config.app.host,
  port: config.app.port,
  path: '/ws'
});

wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  const url = new URL(req.url || '/ws', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  
  ws.id = connectionId;
  ws.userId = token?.split('_')[1] || 'user';
  ws.subscribedBots = new Set();
  ws.lastActivity = Date.now();

  connections.set(connectionId, ws);
  
  console.log(`[${new Date().toISOString()}] 🔌 Connection: ${connectionId} (${ws.userId})`);

  // Send auth OK
  ws.send(JSON.stringify({
    type: 'auth_ok',
    data: { userId: ws.userId, sessionId: connectionId }
  }));

  // Send bots list
  const userBotsList = Array.from(bots.values());
  ws.send(JSON.stringify({
    type: 'status',
    data: { type: 'bots_list', bots: userBotsList }
  }));

  ws.on('message', (data) => {
    try {
      const frame = JSON.parse(data.toString());
      ws.lastActivity = Date.now();
      handleMessage(ws, frame);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', data: { code: 400, message: 'Invalid JSON' } }));
    }
  });

  ws.on('close', () => {
    connections.delete(connectionId);
    console.log(`[${new Date().toISOString()}] ❌ Disconnected: ${connectionId}`);
  });

  ws.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Error: ${err.message}`);
  });
});

function handleMessage(ws, frame) {
  console.log(`[${new Date().toISOString()}] 📨 ${frame.type}:`, frame.data || '');

  switch (frame.type) {
    case 'message':
      handleMessageFrame(ws, frame);
      break;
    case 'task':
      handleTaskFrame(ws, frame);
      break;
    case 'subscribe':
      ws.subscribedBots.add(frame.data.botId);
      ws.send(JSON.stringify({ type: 'status', data: { type: 'subscribed', botId: frame.data.botId } }));
      break;
    case 'status':
      handleStatusRequest(ws, frame);
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
      break;
  }
}

function handleMessageFrame(ws, frame) {
  const { to, text } = frame.data;
  const messageId = uuidv4();

  // Echo with AI-like response
  const responses = [
    `Echo: ${text}`,
    `I heard you say: "${text}"`,
    `You said "${text}" - thanks for sharing!`,
    `Interesting! "${text}" is on my mind too.`
  ];
  const response = responses[Math.floor(Math.random() * responses.length)];

  ws.send(JSON.stringify({
    type: 'message',
    data: {
      id: messageId,
      from: to,
      to: ws.userId,
      type: 'text',
      text: response,
      timestamp: new Date().toISOString()
    }
  }));

  ws.send(JSON.stringify({
    type: 'message_ack',
    data: { messageId, status: 'delivered' }
  }));
}

function handleTaskFrame(ws, frame) {
  const { title, description, priority, botId } = frame.data;
  const taskId = uuidv4();
  
  const task = {
    id: taskId,
    userId: ws.userId,
    botId,
    title,
    description,
    priority,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  
  tasks.set(taskId, task);

  ws.send(JSON.stringify({
    type: 'task_status',
    data: { taskId, status: 'pending' }
  }));
}

function handleStatusRequest(ws, frame) {
  const { request } = frame.data;
  
  if (request === 'bots' || request === 'full') {
    ws.send(JSON.stringify({
      type: 'status',
      data: { type: 'bots_list', bots: Array.from(bots.values()) }
    }));
  }
}

// Start server
wss.on('listening', () => {
  console.log(`\n🦞 Tunnels-to-Bots Web Demo Server`);
  console.log(`================================`);
  console.log(`🌐 Server: ws://localhost:${PORT}/ws`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`🔑 Demo token: t2b_demo12345678\n`);
  console.log(`💡 Open examples/web/index.html in browser to test\n`);
});

wss.on('error', (err) => {
  console.error('Server error:', err.message);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  wss.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  wss.close(() => process.exit(0));
});
