/**
 * Authentication Service
 * Handles JWT tokens, API keys, and user authentication
 */
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
export class AuthService {
    config;
    apiKeys = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * Validate JWT token
     */
    validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwt_secret);
            return decoded;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Generate JWT token
     */
    generateToken(userId, email) {
        const payload = {
            userId,
            email,
            iss: 'tunnels-to-bots',
        };
        return jwt.sign(payload, this.config.jwt_secret, {
            expiresIn: this.config.jwt_expiry,
        });
    }
    /**
     * Validate API key
     */
    validateApiKey(apiKey) {
        // In production, this would check against stored keys
        // For now, simple hash comparison
        if (!apiKey || apiKey.length < 16) {
            return { valid: false };
        }
        // Check if key exists in memory (in production, use Redis/database)
        const keyHash = this.hashKey(apiKey);
        const storedKey = this.apiKeys.get(keyHash);
        if (storedKey) {
            return {
                valid: true,
                userId: storedKey.userId,
                permissions: storedKey.permissions,
            };
        }
        // For development, accept any key that matches pattern
        if (apiKey.startsWith('t2b_') && apiKey.length >= 24) {
            // Extract userId from key (in production, lookup from database)
            const userId = this.extractUserIdFromKey(apiKey);
            if (userId) {
                return {
                    valid: true,
                    userId,
                    permissions: ['read', 'write', 'bots'],
                };
            }
        }
        return { valid: false };
    }
    /**
     * Generate new API key for user
     */
    generateApiKey(userId, name, permissions = ['read', 'write']) {
        const key = `t2b_${randomBytes(this.config.api_key_length / 2).toString('hex')}`;
        const keyHash = this.hashKey(key);
        this.apiKeys.set(keyHash, {
            userId,
            permissions,
            name,
        });
        return key;
    }
    /**
     * Hash API key for storage
     */
    hashKey(key) {
        return createHash('sha256').update(key).digest('hex');
    }
    /**
     * Extract userId from API key (development pattern)
     */
    extractUserIdFromKey(key) {
        // In production, this would be a database lookup
        // For now, extract from key if it follows the pattern
        try {
            const parts = key.split('_');
            if (parts.length >= 3) {
                // Assume format: t2b_<userId>_<random>
                return parts[1];
            }
        }
        catch {
            // Ignore
        }
        return null;
    }
    /**
     * Revoke API key
     */
    revokeApiKey(apiKey) {
        const keyHash = this.hashKey(apiKey);
        return this.apiKeys.delete(keyHash);
    }
    /**
     * Get API key info
     */
    getApiKeyInfo(apiKey) {
        const keyHash = this.hashKey(apiKey);
        const keyInfo = this.apiKeys.get(keyHash);
        return keyInfo ? { name: keyInfo.name, permissions: keyInfo.permissions } : null;
    }
    /**
     * Verify refresh token
     */
    verifyRefreshToken(token) {
        try {
            // Refresh tokens have longer expiry
            const decoded = jwt.verify(token, this.config.jwt_secret, {
                ignoreExpiration: true,
            });
            // Check if it's a refresh token (no explicit check, but refresh tokens typically have different claim)
            return {
                valid: true,
                userId: decoded.userId,
            };
        }
        catch {
            return { valid: false };
        }
    }
    /**
     * Generate refresh token
     */
    generateRefreshToken(userId) {
        return jwt.sign({ userId, type: 'refresh', iss: 'tunnels-to-bots' }, this.config.jwt_secret, { expiresIn: '7d' });
    }
}
//# sourceMappingURL=auth-service.js.map