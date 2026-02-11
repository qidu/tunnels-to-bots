/**
 * Message Router
 * Routes messages between clients, bots, and OpenClaw sessions
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
export class MessageRouter {
    botChannels = new Map(); // botId -> userIds
    userChannels = new Map(); // userId -> botIds
    /**
     * Route a message to the appropriate destination
     */
    async route(senderWs, message) {
        const log = logger.child({ component: 'message-router' });
        try {
            // Validate message
            if (!message.from || !message.to) {
                throw new Error('Invalid message: missing from/to');
            }
            // Build OpenClaw-compatible message
            const openclawMessage = this.buildOpenClawMessage(message);
            // Route based on target type
            if (message.botId) {
                // Send to specific bot (OpenClaw session)
                await this.sendToBot(message.botId, openclawMessage);
                // Send acknowledgment
                this.sendMessageAck(senderWs, openclawMessage.id);
            }
            else if (this.isBotId(message.to)) {
                // Target looks like a bot ID
                await this.sendToBot(message.to, openclawMessage);
                this.sendMessageAck(senderWs, openclawMessage.id);
            }
            else {
                // Direct user-to-user message
                await this.sendToUser(message.to, openclawMessage, senderWs);
                this.sendMessageAck(senderWs, openclawMessage.id);
            }
            log.debug('Message routed', {
                from: message.from,
                to: message.to,
                messageId: openclawMessage.id,
            });
        }
        catch (error) {
            log.error('Failed to route message:', {
                error: error.message,
                from: message.from,
                to: message.to,
            });
            this.sendError(senderWs, 'ROUTING_FAILED', error.message);
        }
    }
    /**
     * Send message to a bot (OpenClaw session)
     */
    async sendToBot(botId, message) {
        const log = logger.child({ component: 'message-router', botId });
        // In a full implementation, this would:
        // 1. Look up the bot's OpenClaw session ID
        // 2. Send the message to OpenClaw gateway via HTTP/WebSocket
        // 3. Handle the bot's response and route back to the client
        // For now, simulate bot response
        log.info('Sending to bot', { messageId: message.id });
        // This would be replaced with actual OpenClaw gateway call
        // Example:
        // await fetch(`http://127.0.0.1:18789/sessions/${botSessionId}/send`, {
        //   method: 'POST',
        //   body: JSON.stringify(message),
        // });
        // Simulate bot echo response after delay
        setTimeout(() => {
            // In real implementation, this would come from the bot
            log.debug('Bot would respond to message', { messageId: message.id });
        }, 1000);
    }
    /**
     * Send message to another user
     */
    async sendToUser(userId, message, senderWs) {
        // In a real implementation, this would use the connection manager
        // to find all connections for the target user and send to each
        logger.debug('Would send to user', {
            userId,
            messageId: message.id,
        });
        // Placeholder: in production, this would lookup connections
        // and send via WebSocket to each of the user's devices
    }
    /**
     * Build OpenClaw-compatible message
     */
    buildOpenClawMessage(params) {
        return {
            id: uuidv4(),
            from: params.from,
            to: params.to,
            type: 'text',
            text: params.text,
            contentType: 'plain',
            timestamp: params.timestamp,
            replyTo: params.replyTo,
            metadata: {
                messageId: uuidv4(),
                direction: 'inbound',
                source: 'client',
            },
        };
    }
    /**
     * Send message acknowledgment
     */
    sendMessageAck(ws, messageId) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
                type: 'message_ack',
                data: {
                    messageId,
                    status: 'delivered',
                    timestamp: Date.now(),
                },
                timestamp: Date.now(),
            }));
        }
    }
    /**
     * Send error to client
     */
    sendError(ws, code, message) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify({
                type: 'error',
                data: { code, message },
                timestamp: Date.now(),
            }));
        }
    }
    /**
     * Check if a string looks like a bot ID
     */
    isBotId(id) {
        // Bot IDs typically start with 'bot_' or are UUIDs
        return id.startsWith('bot_') || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    }
    /**
     * Subscribe user to bot updates
     */
    subscribeToBot(userId, botId) {
        // Track user subscriptions
        if (!this.userChannels.has(userId)) {
            this.userChannels.set(userId, new Set());
        }
        this.userChannels.get(userId).add(botId);
        if (!this.botChannels.has(botId)) {
            this.botChannels.set(botId, new Set());
        }
        this.botChannels.get(botId).add(userId);
    }
    /**
     * Unsubscribe user from bot updates
     */
    unsubscribeFromBot(userId, botId) {
        this.userChannels.get(userId)?.delete(botId);
        this.botChannels.get(botId)?.delete(userId);
    }
    /**
     * Get bot subscribers
     */
    getBotSubscribers(botId) {
        return Array.from(this.botChannels.get(botId) || []);
    }
    /**
     * Broadcast to all subscribers of a bot
     */
    broadcastToBotSubscribers(botId, message) {
        const subscribers = this.getBotSubscribers(botId);
        for (const userId of subscribers) {
            this.sendToUser(userId, message, null);
        }
    }
}
//# sourceMappingURL=message-router.js.map