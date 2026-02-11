#!/usr/bin/env node
/**
 * Tunnels-to-Bots - Compressed WebSocket Server
 * Uses gzip compression for message payloads to reduce bandwidth
 */

import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { inflateSync, deflateSync } from 'zlib';

const PORT = process.env.PORT || 3003;

// Compression utilities
function compress(data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
  return deflateSync(buffer, { level: 9 });
}

function decompress(buffer) {
  const inflated = inflateSync(buffer);
  try { return JSON.parse(inflated.toString()); } 
  catch { return inflated.toString(); }
}

function compressFrame(frame) {
  const json = JSON.stringify(frame);
  const compressed = compress(json);
  return Buffer.concat([Buffer.from([0xFF]), compressed]); // 0xFF = magic byte
}

function isCompressed(buffer) {
  return buffer.length > 0 && buffer[0] === 0xFF;
}

function parseFrame(buffer) {
  if (buffer.length === 0) return null;
  if (isCompressed(buffer)) {
    return decompress(buffer.slice(1));
  }
  try { return JSON.parse(buffer.toString()); } catch { return null; }
}

// Demo data
const bots = new Map([
  ['bot_clawra', { id: 'bot_clawra', name: 'Clawra', type: 'openclaw', status: 'online' }],
  ['bot_helper', { id: 'bot_helper', name: 'Helper', type: 'custom', status: 'online' }],
  ['bot_coder', { id: 'bot_coder', name: 'Coder', type: 'openclaw', status: 'online' }]
]);

const tasks = new Map();
const connections = new Map();
const stats = { msgsIn: 0, msgsOut: 0, bytesIn: 0, bytesOut: 0, compSaved: 0 };

const wss = new WebSocketServer({ host: '0.0.0.0', port: PORT, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/ws', `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  
  const connectionId = uuidv4();
  ws.id = connectionId;
  ws.userId = token?.split('_')[1] || 'user';
  ws.subscribedBots = new Set();
  
  connections.set(connectionId, ws);
  console.log(`[${new Date().toISOString()}] Connected: ${connectionId}`);

  // Send compressed auth OK
  ws.send(compressFrame({ type: 'auth_ok', data: { userId: ws.userId, sessionId: connectionId } }));
  ws.send(compressFrame({ type: 'status', data: { type: 'bots_list', bots: Array.from(bots.values()) } }));

  ws.on('message', (data) => {
    stats.bytesIn += data.length;
    const frame = parseFrame(data);
    if (!frame) return;
    stats.msgsIn++;
    handleMessage(ws, frame);
  });

  ws.on('close', () => connections.delete(connectionId));
});

function sendCompressed(ws, frame) {
  const original = Buffer.byteLength(JSON.stringify(frame));
  const compressed = compressFrame(frame);
  ws.send(compressed);
  stats.msgsOut++;
  stats.bytesOut += compressed.length;
  stats.compSaved += (original - compressed.length);
}

function handleMessage(ws, frame) {
  switch (frame.type) {
    case 'message':
      const responses = [`Echo: ${frame.data.text}`, `I heard: "${frame.data.text}"`];
      sendCompressed(ws, {
        type: 'message', data: {
          id: uuidv4(), from: frame.data.to, to: ws.userId, type: 'text',
          text: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date().toISOString()
        }
      });
      sendCompressed(ws, { type: 'message_ack', data: { messageId: frame.id, status: 'delivered' } });
      break;
    case 'task':
      const taskId = uuidv4();
      tasks.set(taskId, { ...frame.data, id: taskId, status: 'pending' });
      sendCompressed(ws, { type: 'task_status', data: { taskId, status: 'pending' } });
      break;
    case 'subscribe':
      ws.subscribedBots.add(frame.data.botId);
      sendCompressed(ws, { type: 'status', data: { type: 'subscribed', botId: frame.data.botId } });
      break;
    case 'ping':
      sendCompressed(ws, { type: 'pong', data: { timestamp: Date.now() } });
      break;
    case 'status':
      if (frame.data.request === 'bots' || frame.data.request === 'full') {
        sendCompressed(ws, { type: 'status', data: { type: 'bots_list', bots: Array.from(bots.values()) } });
      }
      break;
  }
}

// Print stats every 15 seconds
setInterval(() => {
  if (stats.msgsOut > 0) {
    const ratio = stats.compSaved > 0 ? ((stats.compSaved / (stats.bytesOut + stats.compSaved)) * 100).toFixed(1) : 0;
    console.log(`Stats: msgs=${stats.msgsIn}/${stats.msgsOut}, bytes=${stats.bytesIn}/${stats.bytesOut}, compression=${ratio}%`);
  }
}, 15000);

wss.on('listening', () => {
  console.log(`\nTunnels-to-Bots COMPRESSED Server`);
  console.log(`Server: ws://localhost:${PORT}/ws`);
  console.log(`Compression: gzip with magic byte 0xFF\n`);
});

process.on('SIGINT', () => {
  console.log(`\nFinal Stats: msgs=${stats.msgsIn}/${stats.msgsOut}, saved ${stats.compSaved} bytes`);
  wss.close(() => process.exit(0));
});
