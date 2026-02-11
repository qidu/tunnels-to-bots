/**
 * Tunnels-to-Bots Core Types
 * TypeScript type definitions for the platform
 */
export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash?: string;
    api_key?: string;
    createdAt: Date;
    updatedAt: Date;
    status: 'active' | 'suspended' | 'deleted';
    settings: UserSettings;
}
export interface UserSettings {
    maxBots: number;
    maxSessions: number;
    theme: 'light' | 'dark' | 'system';
    notifications: NotificationSettings;
}
export interface NotificationSettings {
    email: boolean;
    push: boolean;
    messagePreview: boolean;
}
export interface AuthPayload {
    userId: string;
    email: string;
    iat: number;
    exp: number;
    iss: string;
}
export interface ApiKey {
    id: string;
    key: string;
    name: string;
    userId: string;
    permissions: string[];
    lastUsedAt?: Date;
    expiresAt?: Date;
    createdAt: Date;
}
export interface Bot {
    id: string;
    userId: string;
    name: string;
    description: string;
    avatar?: string;
    type: BotType;
    status: BotStatus;
    config: BotConfig;
    openclawSessionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export type BotType = 'openclaw' | 'custom' | 'webhook' | 'llm';
export type BotStatus = 'offline' | 'online' | 'connecting' | 'error' | 'maintenance';
export interface BotConfig {
    systemPrompt?: string;
    welcomeMessage?: string;
    maxMessageLength: number;
    allowFileUpload: boolean;
    allowedCommands: string[];
    metadata?: Record<string, unknown>;
}
export interface BotSession {
    id: string;
    botId: string;
    userId: string;
    channel: string;
    channelSessionId?: string;
    status: 'active' | 'ended';
    createdAt: Date;
    lastActivityAt: Date;
}
export interface BaseMessage {
    id: string;
    from: string;
    to: string;
    timestamp: string;
    channel?: string;
    replyTo?: string;
    metadata?: MessageMetadata;
}
export interface TextMessage extends BaseMessage {
    type: 'text';
    text: string;
    contentType?: 'plain' | 'markdown' | 'html';
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
    systemType: 'bot_connected' | 'bot_disconnected' | 'rateLimit' | 'error';
    code?: string;
    details?: Record<string, unknown>;
}
export type Message = TextMessage | MediaMessage | ActionMessage | SystemMessage;
export interface MessageMetadata {
    messageId: string;
    conversationId?: string;
    direction: 'inbound' | 'outbound';
    source: 'client' | 'bot' | 'system';
    tokens?: number;
    latency?: number;
}
export interface WSFrame {
    type: WSFrameType;
    data: unknown;
    timestamp: number;
    id?: string;
}
export type WSFrameType = 'auth' | 'auth_ok' | 'auth_error' | 'message' | 'message_ack' | 'status' | 'presence' | 'subscribe' | 'unsubscribe' | 'error' | 'ping' | 'pong' | 'task' | 'task_status' | 'analytics' | 'config' | 'bot_command';
export interface ClientConnection {
    id: string;
    userId: string;
    socketId: string;
    socket: WebSocket;
    deviceInfo?: DeviceInfo;
    connectedAt: Date;
    lastActivityAt: Date;
    subscribedBots: Set<string>;
    status: 'connected' | 'connecting' | 'disconnected';
}
export interface DeviceInfo {
    platform: 'web' | 'android' | 'ios' | 'other';
    os?: string;
    browser?: string;
    appVersion?: string;
    deviceId?: string;
    pushToken?: string;
}
export interface SessionConfig {
    maxMessageSize: number;
    heartbeatInterval: number;
    reconnectAttempts: number;
    reconnectDelay: number;
}
export interface ConnectionState {
    connected: boolean;
    reconnecting: boolean;
    lastConnectedAt?: Date;
    error?: string;
}
export interface TunnelConfig {
    provider: TunnelProvider;
    enabled: boolean;
    localPort: number;
    remotePort?: number;
    publicUrl?: string;
    credentials?: TunnelCredentials;
    options?: Record<string, unknown>;
}
export type TunnelProvider = 'frp' | 'tailscale' | 'tunnelto';
export interface TunnelCredentials {
    server_addr?: string;
    server_port?: number;
    auth_token?: string;
    tailnet?: string;
    api_key?: string;
}
export interface TunnelStatus {
    provider: TunnelProvider;
    running: boolean;
    publicUrl?: string;
    localPort: number;
    error?: string;
    startedAt?: Date;
}
export interface TunnelManager {
    start(config: TunnelConfig): Promise<TunnelStatus>;
    stop(): Promise<void>;
    getStatus(): TunnelStatus;
    restart(): Promise<TunnelStatus>;
}
export interface Task {
    id: string;
    userId: string;
    botId: string;
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
    dueDate?: Date;
    completedAt?: Date;
    metadata?: Record<string, unknown>;
}
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
export interface TaskAssignment {
    taskId: string;
    title: string;
    description: string;
    priority: TaskPriority;
    assignedToBotId: string;
    dueDate?: string;
}
export interface AnalyticsEvent {
    type: string;
    userId?: string;
    botId?: string;
    sessionId?: string;
    properties?: Record<string, unknown>;
    timestamp: Date;
}
export interface AnalyticsSummary {
    totalMessages: number;
    totalUsers: number;
    totalBots: number;
    activeConnections: number;
    messagesPerSecond: number;
    averageLatency: number;
    uptime: number;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: ResponseMeta;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface ResponseMeta {
    requestId: string;
    timestamp: string;
    version: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        perPage: number;
        total: number;
        hasMore: boolean;
    };
}
export interface ServerConfig {
    app: AppConfig;
    auth: AuthConfig;
    database: DatabaseConfig;
    sessions: SessionConfig;
    tunnels: TunnelsConfig;
    rateLimit: RateLimitConfig;
    cors: CorsConfig;
    logging: LoggingConfig;
    metrics: MetricsConfig;
}
export interface AppConfig {
    host: string;
    port: number;
    env: 'development' | 'production' | 'test';
}
export interface AuthConfig {
    jwt_secret: string;
    jwt_expiry: string;
    api_key_length: number;
}
export interface DatabaseConfig {
    redis: RedisConfig;
    memory: MemoryConfig;
}
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    keyPrefix: string;
}
export interface MemoryConfig {
    enabled: boolean;
}
export interface TunnelsConfig {
    default_provider: TunnelProvider;
    frp: FrpConfig;
    tailscale: TailscaleConfig;
    tunnelto: TunneltoConfig;
}
export interface FrpConfig {
    enabled: boolean;
    server_addr: string;
    server_port: number;
    auth_token: string;
    configTemplate: string;
}
export interface TailscaleConfig {
    enabled: boolean;
    dns_name: string;
    serve_path: string;
}
export interface TunneltoConfig {
    enabled: boolean;
    serverUrl: string;
    api_key: string;
}
export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
    maxMessagesPerSecond: number;
}
export interface CorsConfig {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
}
export interface LoggingConfig {
    level: string;
    format: 'json' | 'pretty';
    output: string;
}
export interface MetricsConfig {
    enabled: boolean;
    port: number;
    path: string;
}
//# sourceMappingURL=types.d.ts.map