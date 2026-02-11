/**
 * Configuration Loader
 * Loads and validates configuration from YAML files
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { z } from 'zod';
// ============================================================================
// Configuration Schema
// ============================================================================
const AppConfigSchema = z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().min(1).max(65535).default(3000),
    env: z.enum(['development', 'production', 'test']).default('development'),
});
const AuthConfigSchema = z.object({
    jwt_secret: z.string().min(32),
    jwt_expiry: z.string().default('24h'),
    api_key_length: z.number().int().min(16).max(64).default(32),
});
const RedisConfigSchema = z.object({
    host: z.string().default('localhost'),
    port: z.number().int().default(6379),
    password: z.string().optional(),
    key_prefix: z.string().default('tunnels2bots:'),
});
const DatabaseConfigSchema = z.object({
    redis: RedisConfigSchema,
    memory: z.object({
        enabled: z.boolean().default(true),
    }),
});
const SessionsConfigSchema = z.object({
    max_per_user: z.number().int().min(1).max(100).default(10),
    timeout: z.number().int().min(60).default(3600),
    heartbeat_interval: z.number().int().min(5000).default(30000),
});
const RateLimitConfigSchema = z.object({
    window_ms: z.number().int().min(1000).default(60000),
    max_requests: z.number().int().min(1).default(100),
    max_messages_per_second: z.number().int().min(1).default(50),
});
const FrpConfigSchema = z.object({
    enabled: z.boolean().default(true),
    server_addr: z.string().default('localhost'),
    server_port: z.number().int().default(7000),
    auth_token: z.string().optional(),
    config_template: z.string().optional(),
});
const TailscaleConfigSchema = z.object({
    enabled: z.boolean().default(true),
    dns_name: z.string().default('tunnels2bots'),
    serve_path: z.string().default('/ws'),
});
const TunneltoConfigSchema = z.object({
    enabled: z.boolean().default(true),
    server_url: z.string().url().default('https://tunnelto.dev'),
    api_key: z.string().optional(),
});
const TunnelsConfigSchema = z.object({
    default_provider: z.enum(['frp', 'tailscale', 'tunnelto']).default('frp'),
    frp: FrpConfigSchema,
    tailscale: TailscaleConfigSchema,
    tunnelto: TunneltoConfigSchema,
});
const CorsConfigSchema = z.object({
    enabled: z.boolean().default(true),
    origins: z.array(z.string()).default(['*']),
    credentials: z.boolean().default(true),
});
const LoggingConfigSchema = z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    output: z.string().default('stdout'),
});
const MetricsConfigSchema = z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().default(9090),
    path: z.string().default('/metrics'),
});
const ServerConfigSchema = z.object({
    app: AppConfigSchema,
    auth: AuthConfigSchema,
    database: DatabaseConfigSchema,
    sessions: SessionsConfigSchema,
    rate_limit: RateLimitConfigSchema,
    tunnels: TunnelsConfigSchema,
    cors: CorsConfigSchema,
    logging: LoggingConfigSchema,
    metrics: MetricsConfigSchema,
});
let cachedConfig = null;
/**
 * Load configuration from YAML file
 */
export async function loadConfig(configPath) {
    // Return cached config if available
    if (cachedConfig) {
        return cachedConfig;
    }
    const absolutePath = path.resolve(configPath);
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Configuration file not found: ${absolutePath}`);
    }
    // Read and parse YAML
    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const rawConfig = yaml.parse(fileContent);
    // Apply environment variable overrides
    const configWithEnv = applyEnvironmentOverrides(rawConfig);
    // Validate configuration
    const result = ServerConfigSchema.safeParse(configWithEnv);
    if (!result.success) {
        const errors = result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n');
        throw new Error(`Configuration validation failed:\n${errors}`);
    }
    cachedConfig = result.data;
    return cachedConfig;
}
/**
 * Apply environment variable overrides to configuration
 */
function applyEnvironmentOverrides(config) {
    // Environment variable mappings
    const envMappings = {
        'T2B_APP_HOST': { path: ['app', 'host'] },
        'T2B_APP_PORT': { path: ['app', 'port'], transform: parseInt },
        'T2B_APP_ENV': { path: ['app', 'env'] },
        'T2B_JWT_SECRET': { path: ['auth', 'jwt_secret'] },
        'T2B_JWT_EXPIRY': { path: ['auth', 'jwt_expiry'] },
        'T2B_REDIS_HOST': { path: ['database', 'redis', 'host'] },
        'T2B_REDIS_PORT': { path: ['database', 'redis', 'port'], transform: parseInt },
        'T2B_REDIS_PASSWORD': { path: ['database', 'redis', 'password'] },
        'T2B_TUNNEL_PROVIDER': { path: ['tunnels', 'default_provider'] },
        'T2B_FRP_SERVER_ADDR': { path: ['tunnels', 'frp', 'server_addr'] },
        'T2B_FRP_SERVER_PORT': { path: ['tunnels', 'frp', 'server_port'], transform: parseInt },
        'T2B_FRP_AUTH_TOKEN': { path: ['tunnels', 'frp', 'auth_token'] },
        'T2B_LOG_LEVEL': { path: ['logging', 'level'] },
    };
    for (const [envVar, mapping] of Object.entries(envMappings)) {
        const value = process.env[envVar];
        if (value !== undefined) {
            let transformedValue = value;
            if (mapping.transform) {
                transformedValue = mapping.transform(value);
            }
            // Set nested value
            let current = config;
            for (let i = 0; i < mapping.path.length - 1; i++) {
                if (!current[mapping.path[i]]) {
                    current[mapping.path[i]] = {};
                }
                current = current[mapping.path[i]];
            }
            current[mapping.path[mapping.path.length - 1]] = transformedValue;
        }
    }
    return config;
}
/**
 * Get current configuration (cached)
 */
export function getConfig() {
    return cachedConfig;
}
/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache() {
    cachedConfig = null;
}
/**
 * Create default configuration for development
 */
export function createDefaultConfig() {
    return {
        app: {
            host: '0.0.0.0',
            port: 3000,
            env: 'development',
        },
        auth: {
            jwt_secret: 'development-secret-change-in-production-xxxxxxxxxxxx',
            jwt_expiry: '24h',
            api_key_length: 32,
        },
        database: {
            redis: {
                host: 'localhost',
                port: 6379,
                password: '',
                key_prefix: 'tunnels2bots:',
            },
            memory: {
                enabled: true,
            },
        },
        sessions: {
            max_per_user: 10,
            timeout: 3600,
            heartbeat_interval: 30000,
        },
        rate_limit: {
            window_ms: 60000,
            max_requests: 100,
            max_messages_per_second: 50,
        },
        tunnels: {
            default_provider: 'frp',
            frp: {
                enabled: true,
                server_addr: 'localhost',
                server_port: 7000,
                auth_token: '',
                config_template: '',
            },
            tailscale: {
                enabled: true,
                dns_name: 'tunnels2bots',
                serve_path: '/ws',
            },
            tunnelto: {
                enabled: true,
                server_url: 'https://tunnelto.dev',
                api_key: '',
            },
        },
        cors: {
            enabled: true,
            origins: ['*'],
            credentials: true,
        },
        logging: {
            level: 'info',
            format: 'json',
            output: 'stdout',
        },
        metrics: {
            enabled: true,
            port: 9090,
            path: '/metrics',
        },
    };
}
//# sourceMappingURL=config.js.map