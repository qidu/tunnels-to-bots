/**
 * Bot Registry
 * Manages bot registration and status
 */
import type { Bot, BotType, BotStatus, BotConfig } from './types.js';
export declare class BotRegistry {
    private bots;
    private userBots;
    /**
     * Register a new bot for a user
     */
    register(params: {
        userId: string;
        name: string;
        description?: string;
        type: BotType;
        config?: Partial<BotConfig>;
    }): Bot;
    /**
     * Get bot by ID
     */
    getBot(botId: string): Bot | null;
    /**
     * Get all bots for a user
     */
    getUserBots(userId: string): Bot[];
    /**
     * Update bot status
     */
    updateBotStatus(botId: string, status: BotStatus): void;
    /**
     * Update bot configuration
     */
    updateBotConfig(botId: string, config: Partial<BotConfig>): boolean;
    /**
     * Set OpenClaw session ID for bot
     */
    setOpenClawSession(botId: string, sessionId: string): boolean;
    /**
     * Delete bot
     */
    deleteBot(botId: string): boolean;
    /**
     * Get online bots count
     */
    getOnlineCount(): number;
    /**
     * Get all bots (admin only)
     */
    getAllBots(): Bot[];
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        online: number;
        offline: number;
        byType: Record<BotType, number>;
    };
}
//# sourceMappingURL=bot-registry.d.ts.map