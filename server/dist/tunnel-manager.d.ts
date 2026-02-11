/**
 * Tunnel Manager
 * Abstracts tunnel operations across frp, Tailscale, and Tunnelto
 */
import type { TunnelConfig, TunnelProvider, TunnelStatus, ServerConfig } from './types.js';
export declare class TunnelManager {
    private config;
    private activeTunnels;
    private log;
    constructor(config: ServerConfig['tunnels']);
    /**
     * Start default tunnel based on configuration
     */
    startDefault(): Promise<TunnelStatus | null>;
    /**
     * Start a tunnel with specified provider
     */
    start(provider: TunnelProvider, customConfig?: Partial<TunnelConfig>): Promise<TunnelStatus>;
    /**
     * Stop a specific tunnel
     */
    stop(provider: TunnelProvider): Promise<void>;
    /**
     * Stop all tunnels
     */
    stopAll(): Promise<void>;
    /**
     * Get status of a tunnel
     */
    getStatus(provider: TunnelProvider): TunnelStatus;
    /**
     * Get status of all tunnels
     */
    getAllStatus(): TunnelStatus[];
    /**
     * Restart a tunnel
     */
    restart(provider: TunnelProvider): Promise<TunnelStatus>;
    /**
     * Build tunnel configuration
     */
    private buildConfig;
    /**
     * Start frp tunnel
     */
    private startFrpTunnel;
    /**
     * Generate frp configuration
     */
    private generateFrpConfig;
    /**
     * Start Tailscale tunnel
     */
    private startTailscaleTunnel;
    /**
     * Start Tunnelto tunnel
     */
    private startTunneltoTunnel;
}
//# sourceMappingURL=tunnel-manager.d.ts.map