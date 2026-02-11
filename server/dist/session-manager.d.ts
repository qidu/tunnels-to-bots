/**
 * Session Manager
 * Manages user sessions, connections, and tasks
 */
import type { SessionConfig, Task, TaskPriority, TaskStatus } from './types.js';
interface UserSession {
    id: string;
    userId: string;
    connectionIds: Set<string>;
    createdAt: Date;
    lastActivityAt: Date;
}
export declare class SessionManager {
    private config;
    private sessions;
    private userSessions;
    private tasks;
    private userTasks;
    constructor(config: SessionConfig);
    /**
     * Create a new session
     */
    createSession(connectionId: string, userId: string): Promise<UserSession>;
    /**
     * End a session
     */
    endSession(connectionId: string): Promise<void>;
    /**
     * Get session by connection ID
     */
    getSessionByConnection(connectionId: string): UserSession | null;
    /**
     * Get session by user ID
     */
    getSessionByUser(userId: string): UserSession | null;
    /**
     * Get active session count
     */
    getActiveSessionCount(): number;
    /**
     * Get total connection count
     */
    getTotalConnectionCount(): number;
    /**
     * Create a task
     */
    createTask(params: {
        userId: string;
        botId: string;
        title: string;
        description: string;
        priority: TaskPriority;
        dueDate?: string;
    }): Task;
    /**
     * Update task status
     */
    updateTaskStatus(taskId: string, status: TaskStatus): boolean;
    /**
     * Get task by ID
     */
    getTask(taskId: string): Task | null;
    /**
     * Get user's tasks
     */
    getUserTasks(userId: string): Task[];
    /**
     * Get pending tasks for a bot
     */
    getBotPendingTasks(botId: string): Task[];
    /**
     * Cleanup old sessions
     */
    cleanup(): Promise<number>;
    /**
     * Get statistics
     */
    getStats(): {
        activeSessions: number;
        totalConnections: number;
        pendingTasks: number;
        completedTasks: number;
    };
}
export {};
//# sourceMappingURL=session-manager.d.ts.map