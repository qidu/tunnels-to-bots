/**
 * TypeScript types for the JavaScript SDK
 */

// ============================================================================
// Client Configuration
// ============================================================================

export interface ClientOptions {
  /** WebSocket server URL */
  serverUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** JWT token (alternative to API key) */
  token?: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom WebSocket implementation */
  WebSocket?: typeof WebSocket;
}

// ============================================================================
// Message Types
// ============================================================================

export interface BaseMessage {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  type: 'text' | 'media' | 'action' | 'system';
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
  contentType?: 'plain' | 'markdown' | 'html';
  replyTo?: string;
}

export interface MediaMessage extends BaseMessage {
  type: 'media';
  mediaType: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType: string;
  size?: number;
  thumbnailUrl?: string;
  caption?: string;
  duration?: number;
}

export interface ActionMessage extends BaseMessage {
  type: 'action';
  action: 'typing' | 'upload' | 'location' | 'contact';
  data: Record<string, unknown>;
}

export interface SystemMessage extends BaseMessage {
  type: 'system';
  systemType: 'bot_connected' | 'bot_disconnected' | 'rate_limit' | 'error';
  code?: string;
  details?: Record<string, unknown>;
}

export type Message = TextMessage | MediaMessage | ActionMessage | SystemMessage;

// ============================================================================
// WebSocket Frames
// ============================================================================

export interface MessageFrame {
  type: 'message';
  data: {
    to: string;
    text?: string;
    botId?: string;
    channel?: string;
    replyTo?: string;
  };
}

export interface TaskFrame {
  type: 'task';
  data: {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    botId: string;
    dueDate?: string;
  };
}

export interface SubscribeFrame {
  type: 'subscribe';
  data: { botId: string };
}

export interface StatusRequestFrame {
  type: 'status';
  data: { request: 'full' | 'connections' | 'bots' };
}

export type SendFrame = MessageFrame | TaskFrame | SubscribeFrame | StatusRequestFrame;

// ============================================================================
// Bot Types
// ============================================================================

export interface Bot {
  id: string;
  name: string;
  description: string;
  type: 'openclaw' | 'custom' | 'webhook' | 'llm';
  status: 'offline' | 'online' | 'connecting' | 'error';
  config?: {
    systemPrompt?: string;
    welcomeMessage?: string;
  };
}

// ============================================================================
// Task Types
// ============================================================================

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
}

// ============================================================================
// Connection State
// ============================================================================

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  userId?: string;
  sessionId?: string;
  lastConnectedAt?: Date;
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export interface ClientEvents {
  'connect': () => void;
  'disconnect': (code: number, reason: string) => void;
  'error': (error: Error) => void;
  'message': (message: Message) => void;
  'message_ack': (data: { messageId: string; status: string }) => void;
  'status': (data: { type: string; [key: string]: unknown }) => void;
  'auth_ok': (data: { userId: string; sessionId: string }) => void;
  'auth_error': (data: { message: string }) => void;
  'task_status': (data: { taskId: string; status: string }) => void;
  'bot_status': (botId: string, status: string) => void;
  ' reconnecting': () => void;
  'reconnect_failed': (error: Error) => void;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// SDK Configuration Constants
// ============================================================================

export const DEFAULT_OPTIONS: Partial<ClientOptions> = {
  autoReconnect: true,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
  debug: false,
};

export const SDK_VERSION = '1.0.0';