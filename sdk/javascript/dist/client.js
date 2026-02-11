/**
 * Tunnels-to-Bots JavaScript SDK
 */

export class Client {
  constructor(options) {
    this.options = {
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      debug: false,
      ...options
    };
    this.ws = null;
    this.reconnectAttempts = 0;
    this.handlers = new Map();
    this.messageQueue = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.serverUrl);
      if (this.options.apiKey) url.searchParams.set('token', this.options.apiKey);
      if (this.options.token) url.searchParams.set('token', this.options.token);

      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connect', true);
        this.flushQueue();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data);
          const type = frame.type;
          if (this.handlers.has(type)) {
            this.handlers.get(type).forEach(h => h(frame.data));
          }
          if (this.handlers.has('*')) {
            this.handlers.get('*').forEach(h => h(frame));
          }
        } catch (e) {
          if (this.options.debug) console.error('[T2B] Parse error:', e);
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
    const frame = {
      type,
      data,
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    } else {
      this.messageQueue.push(frame);
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
    if (this.options.debug) console.log(`[T2B] Reconnect in ${delay}ms`);
    setTimeout(() => this.connect().catch(() => {}), delay);
  }

  flushQueue() {
    while (this.messageQueue.length > 0) {
      const frame = this.messageQueue.shift();
      this.ws.send(JSON.stringify(frame));
    }
  }

  getState() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      reconnecting: this.reconnectAttempts > 0,
      userId: null
    };
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

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
