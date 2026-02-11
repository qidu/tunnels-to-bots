/**
 * Tunnel Manager
 * Abstracts tunnel operations across frp, Tailscale, and Tunnelto
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from './utils/logger.js';
export class TunnelManager {
    config;
    activeTunnels = new Map();
    log = createChildLogger({ component: 'tunnel-manager' });
    constructor(config) {
        this.config = config;
    }
    /**
     * Start default tunnel based on configuration
     */
    async startDefault() {
        const provider = this.config.default_provider;
        return this.start(provider);
    }
    /**
     * Start a tunnel with specified provider
     */
    async start(provider, customConfig) {
        this.log.info('Starting tunnel', { provider });
        // Check if already running
        const existing = this.activeTunnels.get(provider);
        if (existing) {
            this.log.info('Tunnel already running', { provider });
            return this.getStatus(provider);
        }
        const config = this.buildConfig(provider, customConfig);
        try {
            let status;
            switch (provider) {
                case 'frp':
                    status = await this.startFrpTunnel(config);
                    break;
                case 'tailscale':
                    status = await this.startTailscaleTunnel(config);
                    break;
                case 'tunnelto':
                    status = await this.startTunneltoTunnel(config);
                    break;
                default:
                    throw new Error(`Unknown tunnel provider: ${provider}`);
            }
            this.log.info('Tunnel started successfully', {
                provider,
                publicUrl: status.publicUrl
            });
            return status;
        }
        catch (error) {
            this.log.error('Failed to start tunnel', {
                provider,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Stop a specific tunnel
     */
    async stop(provider) {
        const tunnel = this.activeTunnels.get(provider);
        if (!tunnel) {
            this.log.warn('Tunnel not found', { provider });
            return;
        }
        this.log.info('Stopping tunnel', { provider });
        // Kill the process
        if (tunnel.process.pid) {
            process.kill(tunnel.process.pid, 'SIGTERM');
        }
        // Remove from active tunnels
        this.activeTunnels.delete(provider);
        this.log.info('Tunnel stopped', { provider });
    }
    /**
     * Stop all tunnels
     */
    async stopAll() {
        const providers = Array.from(this.activeTunnels.keys());
        await Promise.all(providers.map(p => this.stop(p)));
    }
    /**
     * Get status of a tunnel
     */
    getStatus(provider) {
        const tunnel = this.activeTunnels.get(provider);
        if (!tunnel) {
            return {
                provider,
                running: false,
                localPort: 0,
            };
        }
        return {
            provider,
            running: true,
            publicUrl: tunnel.config.publicUrl,
            localPort: tunnel.config.localPort,
            startedAt: tunnel.startedAt,
        };
    }
    /**
     * Get status of all tunnels
     */
    getAllStatus() {
        return ['frp', 'tailscale', 'tunnelto'].map(provider => this.getStatus(provider));
    }
    /**
     * Restart a tunnel
     */
    async restart(provider) {
        await this.stop(provider);
        // Wait a bit before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.start(provider);
    }
    /**
     * Build tunnel configuration
     */
    buildConfig(provider, customConfig) {
        const baseConfig = {
            frp: {
                provider: 'frp',
                enabled: this.config.frp.enabled,
                localPort: 3000, // Server port
                credentials: {
                    serverAddr: this.config.frp.server_addr,
                    serverPort: this.config.frp.server_port,
                    authToken: this.config.frp.auth_token,
                },
            },
            tailscale: {
                provider: 'tailscale',
                enabled: this.config.tailscale.enabled,
                localPort: 3000,
                credentials: {},
            },
            tunnelto: {
                provider: 'tunnelto',
                enabled: this.config.tunnelto.enabled,
                localPort: 3000,
                credentials: {
                    apiKey: this.config.tunnelto.api_key,
                },
            },
        };
        const config = { ...baseConfig[provider], ...customConfig };
        return config;
    }
    /**
     * Start frp tunnel
     */
    async startFrpTunnel(config) {
        const log = createChildLogger({ component: 'frp-tunnel' });
        const instanceId = uuidv4().slice(0, 8);
        // Generate frpc config
        const frpcConfig = this.generateFrpConfig(config, instanceId);
        const configPath = path.join('/tmp', `frpc-${instanceId}.ini`);
        fs.writeFileSync(configPath, frpcConfig);
        log.debug('Generated frpc config', { path: configPath });
        // Spawn frpc process
        const proc = spawn('frpc', ['-c', configPath], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const tunnelProcess = {
            id: instanceId,
            provider: 'frp',
            process: proc,
            config: { ...config, publicUrl: `http://${instanceId}.frp.local` },
            startedAt: new Date(),
        };
        // Capture output
        proc.stdout.on('data', (data) => {
            const output = data.toString();
            log.debug('frpc output:', { output: output.slice(0, 200) });
            // Parse public URL from output
            const urlMatch = output.match(/start proxy success\. url = (http[^\s]+)/);
            if (urlMatch) {
                tunnelProcess.config.publicUrl = urlMatch[1];
            }
        });
        proc.stderr.on('data', (data) => {
            log.error('frpc error:', { error: data.toString() });
        });
        proc.on('close', (code) => {
            log.info('frpc process closed', { code });
            this.activeTunnels.delete('frp');
        });
        proc.on('error', (error) => {
            log.error('frpc process error:', { error: error.message });
        });
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Check if process is still running
        if (proc.killed || proc.exitCode !== null) {
            throw new Error('frpc process failed to start');
        }
        this.activeTunnels.set('frp', tunnelProcess);
        return {
            provider: 'frp',
            running: true,
            publicUrl: tunnelProcess.config.publicUrl,
            localPort: config.localPort,
            startedAt: new Date(),
        };
    }
    /**
     * Generate frp configuration
     */
    generateFrpConfig(config, instanceId) {
        const creds = config.credentials;
        let configStr = `[common]
server_addr = ${creds.serverAddr || 'localhost'}
server_port = ${creds.serverPort || 7000}
`;
        if (creds.authToken) {
            configStr += `token = ${creds.authToken}
`;
        }
        configStr += `
[tunnels2bots-${instanceId}]
type = tcp
local_ip = 127.0.0.1
local_port = ${config.localPort}
remote_port = 0  # Let server assign port
`;
        return configStr;
    }
    /**
     * Start Tailscale tunnel
     */
    async startTailscaleTunnel(config) {
        const log = createChildLogger({ component: 'tailscale-tunnel' });
        // Check if tailscale is available
        const checkProc = spawn('tailscale', ['status'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        await new Promise((resolve, reject) => {
            checkProc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error('Tailscale not available'));
                }
                else {
                    resolve(true);
                }
            });
            checkProc.on('error', reject);
            // Timeout
            setTimeout(() => {
                checkProc.kill();
                reject(new Error('Tailscale check timeout'));
            }, 5000);
        });
        const dnsName = this.config.tailscale.dns_name;
        const servePath = this.config.tailscale.serve_path;
        // Start tailscale serve
        const proc = spawn('tailscale', [
            'serve',
            '--bg',
            '--yes',
            '--https', '443',
            '--to', `localhost:${config.localPort}${servePath}`,
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const tunnelProcess = {
            id: uuidv4().slice(0, 8),
            provider: 'tailscale',
            process: proc,
            config: {
                ...config,
                publicUrl: `https://${dnsName}.tailnet.ts.net${servePath}`,
            },
            startedAt: new Date(),
        };
        proc.on('data', (data) => {
            log.debug('tailscale output:', { output: data.toString() });
        });
        proc.on('close', (code) => {
            log.info('tailscale process closed', { code });
            this.activeTunnels.delete('tailscale');
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.activeTunnels.set('tailscale', tunnelProcess);
        return {
            provider: 'tailscale',
            running: true,
            publicUrl: tunnelProcess.config.publicUrl,
            localPort: config.localPort,
            startedAt: new Date(),
        };
    }
    /**
     * Start Tunnelto tunnel
     */
    async startTunneltoTunnel(config) {
        const log = createChildLogger({ component: 'tunnelto-tunnel' });
        const creds = config.credentials;
        const args = [
            'dev',
            '--port', String(config.localPort),
        ];
        if (creds.apiKey) {
            args.push('--auth', creds.apiKey);
        }
        // Random subdomain for dev
        const subdomain = `t2b-${uuidv4().slice(0, 8)}`;
        args.push('--subdomain', subdomain);
        const proc = spawn('tunnelto', args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const tunnelProcess = {
            id: uuidv4().slice(0, 8),
            provider: 'tunnelto',
            process: proc,
            config: {
                ...config,
                publicUrl: `https://${subdomain}.tunnelto.dev`,
            },
            startedAt: new Date(),
        };
        proc.stdout.on('data', (data) => {
            const output = data.toString();
            log.debug('tunnelto output:', { output: output.slice(0, 200) });
            // Parse URL from output
            const urlMatch = output.match(/url[:\s]+(https:\/\/[^\s]+)/i);
            if (urlMatch) {
                tunnelProcess.config.publicUrl = urlMatch[1];
            }
        });
        proc.stderr.on('data', (data) => {
            log.error('tunnelto error:', { error: data.toString() });
        });
        proc.on('close', (code) => {
            log.info('tunnelto process closed', { code });
            this.activeTunnels.delete('tunnelto');
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.activeTunnels.set('tunnelto', tunnelProcess);
        return {
            provider: 'tunnelto',
            running: true,
            publicUrl: tunnelProcess.config.publicUrl,
            localPort: config.localPort,
            startedAt: new Date(),
        };
    }
}
//# sourceMappingURL=tunnel-manager.js.map