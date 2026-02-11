/**
 * Configuration Loader
 * Loads and validates configuration from YAML files
 */
import { z } from 'zod';
declare const ServerConfigSchema: z.ZodObject<{
    app: z.ZodObject<{
        host: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        env: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    }, "strip", z.ZodTypeAny, {
        host: string;
        port: number;
        env: "development" | "production" | "test";
    }, {
        host?: string | undefined;
        port?: number | undefined;
        env?: "development" | "production" | "test" | undefined;
    }>;
    auth: z.ZodObject<{
        jwt_secret: z.ZodString;
        jwt_expiry: z.ZodDefault<z.ZodString>;
        api_key_length: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        jwt_secret: string;
        jwt_expiry: string;
        api_key_length: number;
    }, {
        jwt_secret: string;
        jwt_expiry?: string | undefined;
        api_key_length?: number | undefined;
    }>;
    database: z.ZodObject<{
        redis: z.ZodObject<{
            host: z.ZodDefault<z.ZodString>;
            port: z.ZodDefault<z.ZodNumber>;
            password: z.ZodOptional<z.ZodString>;
            key_prefix: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            host: string;
            port: number;
            key_prefix: string;
            password?: string | undefined;
        }, {
            host?: string | undefined;
            port?: number | undefined;
            password?: string | undefined;
            key_prefix?: string | undefined;
        }>;
        memory: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled?: boolean | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        redis: {
            host: string;
            port: number;
            key_prefix: string;
            password?: string | undefined;
        };
        memory: {
            enabled: boolean;
        };
    }, {
        redis: {
            host?: string | undefined;
            port?: number | undefined;
            password?: string | undefined;
            key_prefix?: string | undefined;
        };
        memory: {
            enabled?: boolean | undefined;
        };
    }>;
    sessions: z.ZodObject<{
        max_per_user: z.ZodDefault<z.ZodNumber>;
        timeout: z.ZodDefault<z.ZodNumber>;
        heartbeat_interval: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        max_per_user: number;
        timeout: number;
        heartbeat_interval: number;
    }, {
        max_per_user?: number | undefined;
        timeout?: number | undefined;
        heartbeat_interval?: number | undefined;
    }>;
    rate_limit: z.ZodObject<{
        window_ms: z.ZodDefault<z.ZodNumber>;
        max_requests: z.ZodDefault<z.ZodNumber>;
        max_messages_per_second: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        window_ms: number;
        max_requests: number;
        max_messages_per_second: number;
    }, {
        window_ms?: number | undefined;
        max_requests?: number | undefined;
        max_messages_per_second?: number | undefined;
    }>;
    tunnels: z.ZodObject<{
        default_provider: z.ZodDefault<z.ZodEnum<["frp", "tailscale", "tunnelto"]>>;
        frp: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            server_addr: z.ZodDefault<z.ZodString>;
            server_port: z.ZodDefault<z.ZodNumber>;
            auth_token: z.ZodOptional<z.ZodString>;
            config_template: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            server_addr: string;
            server_port: number;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            server_addr?: string | undefined;
            server_port?: number | undefined;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        }>;
        tailscale: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            dns_name: z.ZodDefault<z.ZodString>;
            serve_path: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            dns_name: string;
            serve_path: string;
        }, {
            enabled?: boolean | undefined;
            dns_name?: string | undefined;
            serve_path?: string | undefined;
        }>;
        tunnelto: z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            server_url: z.ZodDefault<z.ZodString>;
            api_key: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            server_url: string;
            api_key?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            server_url?: string | undefined;
            api_key?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        frp: {
            enabled: boolean;
            server_addr: string;
            server_port: number;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        };
        tailscale: {
            enabled: boolean;
            dns_name: string;
            serve_path: string;
        };
        tunnelto: {
            enabled: boolean;
            server_url: string;
            api_key?: string | undefined;
        };
        default_provider: "frp" | "tailscale" | "tunnelto";
    }, {
        frp: {
            enabled?: boolean | undefined;
            server_addr?: string | undefined;
            server_port?: number | undefined;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        };
        tailscale: {
            enabled?: boolean | undefined;
            dns_name?: string | undefined;
            serve_path?: string | undefined;
        };
        tunnelto: {
            enabled?: boolean | undefined;
            server_url?: string | undefined;
            api_key?: string | undefined;
        };
        default_provider?: "frp" | "tailscale" | "tunnelto" | undefined;
    }>;
    cors: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        origins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        credentials: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        origins: string[];
        credentials: boolean;
    }, {
        enabled?: boolean | undefined;
        origins?: string[] | undefined;
        credentials?: boolean | undefined;
    }>;
    logging: z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        format: z.ZodDefault<z.ZodEnum<["json", "pretty"]>>;
        output: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        level: "error" | "debug" | "info" | "warn";
        format: "json" | "pretty";
        output: string;
    }, {
        level?: "error" | "debug" | "info" | "warn" | undefined;
        format?: "json" | "pretty" | undefined;
        output?: string | undefined;
    }>;
    metrics: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        port: z.ZodDefault<z.ZodNumber>;
        path: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        path: string;
        enabled: boolean;
    }, {
        port?: number | undefined;
        path?: string | undefined;
        enabled?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    auth: {
        jwt_secret: string;
        jwt_expiry: string;
        api_key_length: number;
    };
    app: {
        host: string;
        port: number;
        env: "development" | "production" | "test";
    };
    database: {
        redis: {
            host: string;
            port: number;
            key_prefix: string;
            password?: string | undefined;
        };
        memory: {
            enabled: boolean;
        };
    };
    sessions: {
        max_per_user: number;
        timeout: number;
        heartbeat_interval: number;
    };
    rate_limit: {
        window_ms: number;
        max_requests: number;
        max_messages_per_second: number;
    };
    tunnels: {
        frp: {
            enabled: boolean;
            server_addr: string;
            server_port: number;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        };
        tailscale: {
            enabled: boolean;
            dns_name: string;
            serve_path: string;
        };
        tunnelto: {
            enabled: boolean;
            server_url: string;
            api_key?: string | undefined;
        };
        default_provider: "frp" | "tailscale" | "tunnelto";
    };
    cors: {
        enabled: boolean;
        origins: string[];
        credentials: boolean;
    };
    logging: {
        level: "error" | "debug" | "info" | "warn";
        format: "json" | "pretty";
        output: string;
    };
    metrics: {
        port: number;
        path: string;
        enabled: boolean;
    };
}, {
    auth: {
        jwt_secret: string;
        jwt_expiry?: string | undefined;
        api_key_length?: number | undefined;
    };
    app: {
        host?: string | undefined;
        port?: number | undefined;
        env?: "development" | "production" | "test" | undefined;
    };
    database: {
        redis: {
            host?: string | undefined;
            port?: number | undefined;
            password?: string | undefined;
            key_prefix?: string | undefined;
        };
        memory: {
            enabled?: boolean | undefined;
        };
    };
    sessions: {
        max_per_user?: number | undefined;
        timeout?: number | undefined;
        heartbeat_interval?: number | undefined;
    };
    rate_limit: {
        window_ms?: number | undefined;
        max_requests?: number | undefined;
        max_messages_per_second?: number | undefined;
    };
    tunnels: {
        frp: {
            enabled?: boolean | undefined;
            server_addr?: string | undefined;
            server_port?: number | undefined;
            auth_token?: string | undefined;
            config_template?: string | undefined;
        };
        tailscale: {
            enabled?: boolean | undefined;
            dns_name?: string | undefined;
            serve_path?: string | undefined;
        };
        tunnelto: {
            enabled?: boolean | undefined;
            server_url?: string | undefined;
            api_key?: string | undefined;
        };
        default_provider?: "frp" | "tailscale" | "tunnelto" | undefined;
    };
    cors: {
        enabled?: boolean | undefined;
        origins?: string[] | undefined;
        credentials?: boolean | undefined;
    };
    logging: {
        level?: "error" | "debug" | "info" | "warn" | undefined;
        format?: "json" | "pretty" | undefined;
        output?: string | undefined;
    };
    metrics: {
        port?: number | undefined;
        path?: string | undefined;
        enabled?: boolean | undefined;
    };
}>;
export type Config = z.infer<typeof ServerConfigSchema>;
/**
 * Load configuration from YAML file
 */
export declare function loadConfig(configPath: string): Promise<Config>;
/**
 * Get current configuration (cached)
 */
export declare function getConfig(): Config | null;
/**
 * Clear cached configuration (for testing)
 */
export declare function clearConfigCache(): void;
/**
 * Create default configuration for development
 */
export declare function createDefaultConfig(): Config;
export {};
//# sourceMappingURL=config.d.ts.map