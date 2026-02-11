/**
 * Message Router
 * Routes messages between clients, bots, and OpenClaw sessions
 */
import type { ExtendedWebSocket } from './server.js';
import type { Message } from './types.js';
export declare class MessageRouter {
    private botChannels;
    private userChannels;
    /**
     * Route a message to the appropriate destination
     */
    route(senderWs: ExtendedWebSocket, message: {
        from: string;
        to: string;
        text: string;
        botId?: string;
        channel?: string;
        replyTo?: string;
        timestamp: string;
    }): Promise<void>;
    /**
     * Send message to a bot (OpenClaw session)
     */
    private sendToBot;
    /**
     * Send message to another user
     */
    private sendToUser;
    /**
     * Build OpenClaw-compatible message
     */
    private buildOpenClawMessage;
    /**
     * Send message acknowledgment
     */
    private sendMessageAck;
    /**
     * Send error to client
     */
    private sendError;
    /**
     * Check if a string looks like a bot ID
     */
    private isBotId;
    /**
     * Subscribe user to bot updates
     */
    subscribeToBot(userId: string, botId: string): void;
    /**
     * Unsubscribe user from bot updates
     */
    unsubscribeFromBot(userId: string, botId: string): void;
    /**
     * Get bot subscribers
     */
    getBotSubscribers(botId: string): string[];
    /**
     * Broadcast to all subscribers of a bot
     */
    broadcastToBotSubscribers(botId: string, message: Message): void;
}
//# sourceMappingURL=message-router.d.ts.map