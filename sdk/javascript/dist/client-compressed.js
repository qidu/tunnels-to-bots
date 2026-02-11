/**
 * Tunnels-to-Bots JavaScript SDK WITH COMPRESSION
 * Uses gzip deflate for message payloads - reduces bandwidth by ~50%
 */

import { inflateSync, deflateSync } from 'zlib';

const MAGIC_BYTE = 0xFF;

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

function isCompressed(buffer) {
  return buffer.length > 0 && buffer[0] === MAGIC_BYTE;
}

function parseFrame(buffer) {
  if (buffer.length === 0) return null;
  if (isCompressed(buffer)) {
    return decompress(buffer.slice(1));
  }
  try { return JSON.parse(buffer.toString()); } catch { return null; }
}

function compressFrame(frame) {
  const json = JSON.stringify(frame);
  const compressed = compress(json);
  return Buffer.concat([Buffer.from([MAGIC_BYTE]), compressed]);
}

// ============================================================================
// Compressed Client
// ============================================================================

export class CompressedClient {
  constructor(options = {}) {
    this.options = {
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      debug: false,
      compress: true, // Enable compression by default
      ...options
    };
    this.ws = null;
    this.reconnectAttempts = 0;
    this.handlers = new Map();
    this.messageQueue = [];
    this.stats = { sent: 0, received: 0, bytesSent: 0, bytesReceived: 0, compressionRatio: 0 };
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.serverUrl);
      if (this.options.apiKey) url.searchParams.set('token', this.options.apiKey);
      if (this.options.token) url.searchParams.set('token', this.options.token);

      this.ws = new WebSocket(url.toString());

      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connect', true);
        this.flushQueue();
        resolve();
      };

      this.ws.onmessage = (event) => {
        const buffer = event.data instanceof ArrayBuffer ? new Uint8Array(event.data) : event.data;
        this.stats.bytesReceived += buffer.length;
        
        const frame = parseFrame(buffer);
        if (frame) {
          this.stats.received++;
          const type = frame.type;
          if (this.handlers.has(type)) {
            this.handlers.get(type).forEach(h => h(frame.data));
          }
          if (this.handlers.has('*')) {
            this.handlers.get('*').forEach(h => h(frame));
          }
        }
      };

      this.ws.onclose = () => {
        this.emit('disconnect');
        if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type, data = {}) {
    const frame = { type, data, timestamp: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
    
    if (this.options.compress) {
      const compressed = compressFrame(frame);
      this.stats.bytesSent += compressed.length;
      const original = Buffer.byteLength(JSON.stringify(frame));
      this.stats.sent++;
      this.stats.compressionRatio = ((1 - compressed.length / original) * 100).toFixed(1);
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(compressed);
      } else {
        this.messageQueue.push(compressed);
      }
    } else {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(frame));
      } else {
        this.messageQueue.push(JSON.stringify(frame));
      }
    }
    return frame.id;
  }

  sendMessage(params) {
    return this.send('message', params);
  }

  createTask(params) {
    return this.send('task', params);
  }

  subscribeToBot(botId) {
    this.send('subscribe', { botId });
  }

  unsubscribeFromBot(botId) {
    this.send('unsubscribe', { botId });
  }

  requestStatus(request = 'full') {
    this.send('status', { request });
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
    return this;
  }

  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    if (this.handlers.has(event)) {
      const list = this.handlers.get(event);
      const idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }
    return this;
  }

  emit(event, data) {
    if (this.handlers.has(event)) {
      this.handlers.get(event).forEach(h => h(data));
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    if (this.options.debug) console.log(`[T2B] Reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  flushQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(msg);
      }
    }
  }

  getState() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      reconnecting: this.reconnectAttempts > 0,
      userId: null,
      compressionRatio: this.stats.compressionRatio
    };
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getStats() {
    return { ...this.stats };
  }
}

// Utility functions
export function generateApiKey(prefix = 't2b') {
  const random = Array(16).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${prefix}_${random}`;
}

export function parseServerUrl(url) {
  const parsed = new URL(url);
  return {
    serverUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
    apiKey: parsed.searchParams.get('token') || undefined
  };
}
