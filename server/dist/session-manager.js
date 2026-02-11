/**
 * Session Manager
 * Manages user sessions, connections, and tasks
 */
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
export class SessionManager {
    config;
    sessions = new Map();
    userSessions = new Map(); // userId -> sessionId
    tasks = new Map();
    userTasks = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * Create a new session
     */
    async createSession(connectionId, userId) {
        let session = this.userSessions.get(userId);
        if (session) {
            // Reuse existing session
            const existingSession = this.sessions.get(session);
            existingSession.connectionIds.add(connectionId);
            existingSession.lastActivityAt = new Date();
            return existingSession;
        }
        // Create new session
        const sessionId = uuidv4();
        session = {
            id: sessionId,
            userId,
            connectionIds: new Set([connectionId]),
            createdAt: new Date(),
            lastActivityAt: new Date(),
        };
        this.sessions.set(sessionId, session);
        this.userSessions.set(userId, sessionId);
        logger.info('Session created', { sessionId, userId, connectionId });
        return session;
    }
    /**
     * End a session
     */
    async endSession(connectionId) {
        for (const [sessionId, session] of this.sessions) {
            if (session.connectionIds.has(connectionId)) {
                session.connectionIds.delete(connectionId);
                // If no more connections, end the session
                if (session.connectionIds.size === 0) {
                    this.sessions.delete(sessionId);
                    this.userSessions.delete(session.userId);
                    logger.info('Session ended', { sessionId, userId: session.userId });
                }
                else {
                    // Keep session alive for other connections
                    logger.debug('Connection removed from session', {
                        sessionId,
                        remainingConnections: session.connectionIds.size
                    });
                }
                return;
            }
        }
    }
    /**
     * Get session by connection ID
     */
    getSessionByConnection(connectionId) {
        for (const session of this.sessions.values()) {
            if (session.connectionIds.has(connectionId)) {
                return session;
            }
        }
        return null;
    }
    /**
     * Get session by user ID
     */
    getSessionByUser(userId) {
        const sessionId = this.userSessions.get(userId);
        if (sessionId) {
            return this.sessions.get(sessionId) || null;
        }
        return null;
    }
    /**
     * Get active session count
     */
    getActiveSessionCount() {
        return this.sessions.size;
    }
    /**
     * Get total connection count
     */
    getTotalConnectionCount() {
        let count = 0;
        for (const session of this.sessions.values()) {
            count += session.connectionIds.size;
        }
        return count;
    }
    /**
     * Create a task
     */
    createTask(params) {
        const taskId = uuidv4();
        const dueDate = params.dueDate ? new Date(params.dueDate) : undefined;
        const task = {
            id: taskId,
            userId: params.userId,
            botId: params.botId,
            title: params.title,
            description: params.description,
            priority: params.priority,
            status: 'pending',
            createdAt: new Date(),
            dueDate,
        };
        this.tasks.set(taskId, task);
        // Track user's tasks
        if (!this.userTasks.has(params.userId)) {
            this.userTasks.set(params.userId, new Set());
        }
        this.userTasks.get(params.userId).add(taskId);
        logger.info('Task created', {
            taskId,
            userId: params.userId,
            botId: params.botId,
            priority: params.priority
        });
        return {
            id: task.id,
            userId: task.userId,
            botId: task.botId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            createdAt: task.createdAt,
            dueDate: task.dueDate,
        };
    }
    /**
     * Update task status
     */
    updateTaskStatus(taskId, status) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return false;
        }
        task.status = status;
        if (status === 'completed') {
            task.dueDate = new Date();
        }
        logger.info('Task status updated', { taskId, status });
        return true;
    }
    /**
     * Get task by ID
     */
    getTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) {
            return null;
        }
        return {
            id: task.id,
            userId: task.userId,
            botId: task.botId,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            createdAt: task.createdAt,
            updatedAt: new Date(),
            dueDate: task.dueDate,
        };
    }
    /**
     * Get user's tasks
     */
    getUserTasks(userId) {
        const taskIds = this.userTasks.get(userId);
        if (!taskIds) {
            return [];
        }
        return Array.from(taskIds).map(id => this.getTask(id)).filter(Boolean);
    }
    /**
     * Get pending tasks for a bot
     */
    getBotPendingTasks(botId) {
        const pending = [];
        for (const task of this.tasks.values()) {
            if (task.botId === botId && task.status === 'pending') {
                pending.push({
                    id: task.id,
                    userId: task.userId,
                    botId: task.botId,
                    title: task.title,
                    description: task.description,
                    priority: task.priority,
                    status: task.status,
                    createdAt: task.createdAt,
                    updatedAt: new Date(),
                    dueDate: task.dueDate,
                });
            }
        }
        // Sort by priority
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        return pending;
    }
    /**
     * Cleanup old sessions
     */
    async cleanup() {
        const timeout = this.config.timeout * 1000;
        const now = Date.now();
        let cleaned = 0;
        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivityAt.getTime() > timeout) {
                // End all connections in the session
                for (const connId of session.connectionIds) {
                    await this.endSession(connId);
                }
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info('Cleanup completed', { cleanedSessions: cleaned });
        }
        return cleaned;
    }
    /**
     * Get statistics
     */
    getStats() {
        let pendingTasks = 0;
        let completedTasks = 0;
        for (const task of this.tasks.values()) {
            if (task.status === 'pending')
                pendingTasks++;
            else if (task.status === 'completed')
                completedTasks++;
        }
        return {
            activeSessions: this.getActiveSessionCount(),
            totalConnections: this.getTotalConnectionCount(),
            pendingTasks,
            completedTasks,
        };
    }
}
//# sourceMappingURL=session-manager.js.map