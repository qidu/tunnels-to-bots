/**
 * OpenClaw Protocol Adapter
 * Adapts OpenClaw gateway message schema for tunnels-to-bots
 */
import type { Message } from '../types.js';
/**
 * OpenClaw Gateway Protocol Message Format
 * Reference: https://docs.openclaw.ai/protocol
 */
export interface OpenClawMessage {
    id: string;
    channel: string;
    source: {
        type: 'user' | 'agent' | 'system';
        authorId: string;
        authorName?: string;
    };
    target: {
        type: 'session' | 'channel' | 'user';
        id: string;
    };
    content: {
        type: 'text' | 'media' | 'action' | 'composite';
        text?: string;
        media?: {
            type: 'image' | 'audio' | 'video' | 'file';
            url: string;
            mimeType: string;
            size?: number;
            metadata?: Record<string, unknown>;
        };
        actions?: Array<{
            type: string;
            label: string;
            value: string;
        }>;
    };
    timestamp: string;
    replyTo?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Convert tunnels-to-bots message to OpenClaw format
 */
export declare function toOpenClawFormat(message: Message, options: {
    channel: string;
    sourceType: 'user' | 'agent' | 'system';
    targetSessionId?: string;
}): OpenClawMessage;
/**
 * Convert OpenClaw message to tunnels-to-bots format
 */
export declare function fromOpenClawFormat(message: OpenClawMessage): Message;
/**
 * OpenClaw Session create request
 */
export interface OpenClawSessionRequest {
    kind: 'session.create';
    payload: {
        model?: string;
        channel?: string;
        systemPrompt?: string;
        metadata?: Record<string, unknown>;
    };
}
/**
 * OpenClaw Agent turn request
 */
export interface OpenClawAgentTurn {
    kind: 'agentTurn';
    message: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
}
/**
 * Send message to OpenClaw gateway
 */
export declare function sendToOpenClaw(gatewayUrl: string, sessionId: string, message: OpenClawMessage): Promise<OpenClawMessage | null>;
/**
 * Create a new OpenClaw session
 */
export declare function createOpenClawSession(gatewayUrl: string, options: {
    model?: string;
    channel?: string;
    systemPrompt?: string;
}): Promise<string | null>;
/**
 * Get OpenClaw session status
 */
export declare function getOpenClawSession(gatewayUrl: string, sessionId: string): Promise<{
    id: string;
    status: string;
    model: string;
    channel: string;
} | null>;
/**
 * Close OpenClaw session
 */
export declare function closeOpenClawSession(gatewayUrl: string, sessionId: string): Promise<boolean>;
//# sourceMappingURL=openclaw-adapter.d.ts.map