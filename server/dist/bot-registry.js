/**
 * Bot Registry
 * Manages bot registration and status
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
export class BotRegistry {
    bots = new Map();
    userBots = new Map(); // userId -> botIds
    /**
     * Register a new bot for a user
     */
    register(params) {
        const botId = `bot_${uuidv4().slice(0, 8)}`;
        const bot = {
            id: botId,
            userId: params.userId,
            name: params.name,
            description: params.description || '',
            type: params.type,
            status: 'offline',
            config: {
                systemPrompt: params.config?.systemPrompt,
                welcomeMessage: params.config?.welcomeMessage,
                maxMessageLength: params.config?.maxMessageLength || 4096,
                allowFileUpload: params.config?.allowFileUpload ?? false,
                allowedCommands: params.config?.allowedCommands || ['help', 'status'],
                metadata: params.config?.metadata,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.bots.set(botId, bot);
        // Track user's bots
        if (!this.userBots.has(params.userId)) {
            this.userBots.set(params.userId, new Set());
        }
        this.userBots.get(params.userId).add(botId);
        logger.info('Bot registered', { botId, userId: params.userId, name: params.name });
        return {
            id: bot.id,
            userId: bot.userId,
            name: bot.name,
            description: bot.description,
            type: bot.type,
            status: bot.status,
            config: bot.config,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt,
        };
    }
    /**
     * Get bot by ID
     */
    getBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            return null;
        }
        return {
            id: bot.id,
            userId: bot.userId,
            name: bot.name,
            description: bot.description,
            type: bot.type,
            status: bot.status,
            config: bot.config,
            openclawSessionId: bot.openclawSessionId,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt,
        };
    }
    /**
     * Get all bots for a user
     */
    getUserBots(userId) {
        const botIds = this.userBots.get(userId);
        if (!botIds) {
            return [];
        }
        return Array.from(botIds).map(id => this.getBot(id)).filter(Boolean);
    }
    /**
     * Update bot status
     */
    updateBotStatus(botId, status) {
        const bot = this.bots.get(botId);
        if (bot) {
            bot.status = status;
            bot.lastActivity = new Date();
            bot.updatedAt = new Date();
            logger.debug('Bot status updated', { botId, status });
        }
    }
    /**
     * Update bot configuration
     */
    updateBotConfig(botId, config) {
        const bot = this.bots.get(botId);
        if (!bot) {
            return false;
        }
        bot.config = { ...bot.config, ...config };
        bot.updatedAt = new Date();
        logger.info('Bot config updated', { botId });
        return true;
    }
    /**
     * Set OpenClaw session ID for bot
     */
    setOpenClawSession(botId, sessionId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            return false;
        }
        bot.openclawSessionId = sessionId;
        bot.status = 'online';
        bot.updatedAt = new Date();
        logger.info('Bot connected to OpenClaw', { botId, sessionId });
        return true;
    }
    /**
     * Delete bot
     */
    deleteBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) {
            return false;
        }
        this.bots.delete(botId);
        this.userBots.get(bot.userId)?.delete(botId);
        logger.info('Bot deleted', { botId, userId: bot.userId });
        return true;
    }
    /**
     * Get online bots count
     */
    getOnlineCount() {
        let count = 0;
        for (const bot of this.bots.values()) {
            if (bot.status === 'online') {
                count++;
            }
        }
        return count;
    }
    /**
     * Get all bots (admin only)
     */
    getAllBots() {
        return Array.from(this.bots.values()).map(bot => ({
            id: bot.id,
            userId: bot.userId,
            name: bot.name,
            description: bot.description,
            type: bot.type,
            status: bot.status,
            config: bot.config,
            openclawSessionId: bot.openclawSessionId,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt,
        }));
    }
    /**
     * Get statistics
     */
    getStats() {
        const stats = {
            total: 0,
            online: 0,
            offline: 0,
            byType: {
                openclaw: 0,
                custom: 0,
                webhook: 0,
                llm: 0,
            },
        };
        for (const bot of this.bots.values()) {
            stats.total++;
            if (bot.status === 'online') {
                stats.online++;
            }
            else {
                stats.offline++;
            }
            stats.byType[bot.type]++;
        }
        return stats;
    }
}
//# sourceMappingURL=bot-registry.js.map