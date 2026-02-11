/**
 * WebSocket Client
 * Main client class for connecting to tunnels-to-bots server
 */

import type { 
  ClientOptions, 
  Message, 
  SendFrame, 
  ConnectionState,
  ClientEvents,
  TextMessage,
  Task,
  Bot
} from './types.js';
import { DEFAULT_OPTIONS, SDK_VERSION } from './types.js';
import { EventEmitter } from 'events';

type EventKeys = keyof ClientEvents;
type EventHandler<T extends EventKeys> = ClientEvents[T];

export class Client extends EventEmitter {
  private options: Required<ClientOptions>;
  private ws: WebSocket | null = null;
  private state: ConnectionState = {
    connected: false,
    reconnecting: false,
  };
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: SendFrame[] = [];

  constructor(options: ClientOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options } as Required<ClientOptions>;
    
    if (this.options.debug) {
      console.log('[Tunnels2Bots] Client initialized', { version: SDK_VERSION });
    }
  }

  /**
   * Connect to the server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.connected) {
        resolve();
        return;
      }

      try {
        const WebSocketClass = this.options.WebSocket || WebSocket;
        const url = this.buildAuthUrl();
        this.ws = new WebSocketClass(url);

        this.ws.onopen = () => {
          if (this.options.debug) {
            console.log('[Tunnels2Bots] Connected');
          }
          this.handleOpen();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event.code, event.reason);
        };

        this.ws.onerror = (error) => {
          this.handleError(error as Error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnect();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = {
      connected: false,
      reconnecting: false,
    };

    if (this.options.debug) {
      console.log('[Tunnels2Bots] Disconnected');
    }
  }

  /**
   * Send a text message
   */
  sendMessage(params: {
    to: string;
    text: string;
    botId?: string;
    replyTo?: string;
  }): string {
    const messageId = this.sendFrame({
      type: 'message',
      data: {
        to: params.to,
        text: params.text,
        botId: params.botId,
        replyTo: params.replyTo,
      },
    });

    return messageId;
  }

  /**
   * Create and send a task to a bot
   */
  createTask(params: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    botId: string;
    dueDate?: string;
  }): string {
    return this.sendFrame({
      type: 'task',
      data: {
        title: params.title,
        description: params.description,
        priority: params.priority,
        botId: params.botId,
        dueDate: params.dueDate,
      },
    });
  }

  /**
   * Subscribe to bot updates
   */
  subscribeToBot(botId: string): void {
    this.sendFrame({
      type: 'subscribe',
      data: { botId },
    });
  }

  /**
   * Unsubscribe from bot updates
   */
  unsubscribeFromBot(botId: string): void {
    this.sendFrame({
      type: 'unsubscribe',
      data: { botId },
    });
  }

  /**
   * Request server status
   */
  requestStatus(request: 'full' | 'connections' | 'bots' = 'full'): void {
    this.sendFrame({
      type: 'status',
      data: { request },
    });
  }

  /**
   * Send raw frame
   */
  sendFrame(frame: SendFrame): string {
    const fullFrame = {
      ...frame,
      timestamp: Date.now(),
      id: this.generateId(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullFrame));
    } else {
      // Queue for later
      this.messageQueue.push(frame);
    }

    return fullFrame.id;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.connected;
  }

  /**
   * Event emitter methods with type safety
   */
  override on<K extends EventKeys>(event: K, handler: EventHandler<K>): this {
    return super.on(event, handler);
  }

  override once<K extends EventKeys>(event: K, handler: EventHandler<K>): this {
    return super.once(event, handler);
  }

  override off<K extends EventKeys>(event: K, handler: EventHandler<K>): this {
    return super.off(event, handler);
  }

  // Private methods

  private buildAuthUrl(): string {
    const url = new URL(this.options.serverUrl);
    
    if (this.options.apiKey) {
      url.searchParams.set('token', this.options.apiKey);
    } else if (this.options.token) {
      url.searchParams.set('token', this.options.token);
    }

    return url.toString();
  }

  private handleOpen(): void {
    this.state.connected = true;
    this.state.reconnecting = false;
    this.reconnectAttempts = 0;
    this.state.lastConnectedAt = new Date();

    // Start heartbeat
    this.startHeartbeat();

    // Flush message queue
    this.flushMessageQueue();

    this.emit('connect');
  }

  private handleClose(code: number, reason: string): void {
    this.state.connected = false;
    this.stopHeartbeat();

    this.emit('disconnect', code, reason);

    // Auto-reconnect
    if (this.options.autoReconnect && code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    this.state.error = error.message;
    this.emit('error', error);
  }

  private handleMessage(data: string): void {
    try {
      const frame = JSON.parse(data);

      switch (frame.type) {
        case 'message':
          this.emit('message', frame.data as Message);
          break;
        case 'message_ack':
          this.emit('message_ack', frame.data);
          break;
        case 'status':
          this.emit('status', frame.data);
          if (frame.data.type === 'bots_list') {
            (frame.data.bots as Bot[]).forEach(bot => {
              this.emit('bot_status', bot.id, bot.status);
            });
          }
          break;
        case 'auth_ok':
          this.state.userId = frame.data.userId;
          this.state.sessionId = frame.data.sessionId;
          this.emit('auth_ok', frame.data);
          break;
        case 'auth_error':
          this.emit('auth_error', frame.data);
          break;
        case 'task_status':
          this.emit('task_status', frame.data);
          break;
        case 'pong':
          // Heartbeat response
          break;
        case 'error':
          console.error('[Tunnels2Bots] Server error:', frame.data);
          break;
        default:
          if (this.options.debug) {
            console.log('[Tunnels2Bots] Unknown frame:', frame.type);
          }
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[Tunnels2Bots] Failed to parse message:', error);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.state.reconnecting = false;
      this.emit('reconnect_failed', new Error('Max reconnection attempts reached'));
      return;
    }

    this.state.reconnecting = true;
    this.reconnectAttempts++;
    this.emit('reconnecting');

    const delay = this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    if (this.options.debug) {
      console.log(`[Tunnels2Bots] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('reconnect_failed', error);
      });
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const frame = this.messageQueue.shift();
      if (frame) {
        this.sendFrame(frame);
      }
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}