/**
 * Authentication Service
 * Handles JWT tokens, API keys, and user authentication
 */
import type { AuthConfig, AuthPayload } from '../types.js';
interface ApiKeyValidation {
    valid: boolean;
    userId?: string;
    permissions?: string[];
}
export declare class AuthService {
    private config;
    private apiKeys;
    constructor(config: AuthConfig);
    /**
     * Validate JWT token
     */
    validateToken(token: string): AuthPayload | null;
    /**
     * Generate JWT token
     */
    generateToken(userId: string, email: string): string;
    /**
     * Validate API key
     */
    validateApiKey(apiKey: string): ApiKeyValidation;
    /**
     * Generate new API key for user
     */
    generateApiKey(userId: string, name: string, permissions?: string[]): string;
    /**
     * Hash API key for storage
     */
    private hashKey;
    /**
     * Extract userId from API key (development pattern)
     */
    private extractUserIdFromKey;
    /**
     * Revoke API key
     */
    revokeApiKey(apiKey: string): boolean;
    /**
     * Get API key info
     */
    getApiKeyInfo(apiKey: string): {
        name: string;
        permissions: string[];
    } | null;
    /**
     * Verify refresh token
     */
    verifyRefreshToken(token: string): {
        valid: boolean;
        userId?: string;
    };
    /**
     * Generate refresh token
     */
    generateRefreshToken(userId: string): string;
}
export {};
//# sourceMappingURL=auth-service.d.ts.map