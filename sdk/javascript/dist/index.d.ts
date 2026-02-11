/**
 * Tunnels-to-Bots JavaScript SDK Type Definitions
 */

export interface ClientOptions {
  serverUrl: string;
  apiKey?: string;
  token?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  text?: string;
  type: 'text' | 'media' | 'action' | 'system';
  timestamp: string;
}

export interface Bot {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  userId?: string;
  sessionId?: string;
}

export declare class Client {
  constructor(options: ClientOptions);
  connect(): Promise<void>;
  disconnect(): void;
  sendMessage(params: { to: string; text: string; botId?: string; replyTo?: string }): string;
  createTask(params: { title: string; description: string; priority: string; botId: string; dueDate?: string }): string;
  subscribeToBot(botId: string): void;
  unsubscribeFromBot(botId: string): void;
  requestStatus(request?: string): void;
  on(event: string, handler: (data: unknown) => void): this;
  once(event: string, handler: (data: unknown) => void): this;
  off(event: string, handler: (data: unknown) => void): this;
  getState(): ConnectionState;
  isConnected(): boolean;
}

export declare function createTextMessage(to: string, text: string): { build(): Message };
export declare function createTask(botId: string, title: string, description: string): { setPriority(p: string): { build(): Task } };
export declare function generateApiKey(prefix?: string): string;
export declare function parseServerUrl(url: string): Partial<ClientOptions>;
