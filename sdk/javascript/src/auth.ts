/**
 * Authentication helpers for the SDK
 */

import type { ClientOptions } from './types.js';

/**
 * Generate a random API key for development/testing
 */
export function generateApiKey(prefix: string = 't2b'): string {
  const randomBytes = typeof crypto !== 'undefined' && crypto.randomBytes
    ? crypto.randomBytes(16).toString('hex')
    : Array(32).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  
  return `${prefix}_${randomBytes}`;
}

/**
 * Parse authentication from URL or environment
 */
export function getAuthFromEnv(): { apiKey?: string; token?: string } {
  return {
    apiKey: process.env.T2B_API_KEY,
    token: process.env.T2B_TOKEN,
  };
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string): boolean {
  return typeof key === 'string' && 
         key.length >= 16 && 
         key.startsWith('t2b_');
}

/**
 * Create client options from URL string (for quick setup)
 */
export function parseServerUrl(url: string): Partial<ClientOptions> {
  const parsed = new URL(url);
  
  return {
    serverUrl: `${parsed.protocol}//${parsed.host}${parsed.pathname}`,
    apiKey: parsed.searchParams.get('token') || undefined,
  };
}

/**
 * Storage helpers for persisting authentication
 */
export class AuthStorage {
  private static STORAGE_KEY = 't2b_auth';

  /**
   * Save auth token to storage
   */
  static saveToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ token }));
    }
  }

  /**
   * Load auth token from storage
   */
  static loadToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          return parsed.token || null;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * Clear auth token from storage
   */
  static clearToken(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}