/**
 * Tunnels-to-Bots Channel Plugin for OpenClaw
 * 
 * This plugin enables OpenClaw instances to connect to the tunnels-to-bots
 * platform, exposing bots through secure WebSocket tunnels.
 * 
 * Usage:
 * 1. Install: npm install @openclaw/tunnel-channel
 * 2. Configure: Add tunnel settings to OpenClaw config
 * 3. Start: OpenClaw will automatically connect and register bots
 */

import type {
  ChannelPlugin,
  ChannelConfigAdapter,
  ChannelConfigSchema,
  ChannelStatusAdapter,
  ChannelOutboundAdapter,
  ChannelGatewayAdapter,
} from "openclaw/dist/channels/plugins/types.plugin.d.ts";
import { v4 as uuidv4 } from "uuid";
import { TunnelConnection } from "./tunnel.js";
import { tunnelCapabilities, tunnelMeta } from "./types.js";
import { TunnelConfigSchema, validateTunnelConfig } from "./config.js";

// Types
interface TunnelAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  serverUrl: string;
  apiKey: string;
  botIds: string[];
}

interface TunnelRuntime {
  tunnel: TunnelConnection | null;
  lastError: string | null;
  lastConnectedAt: number | null;
}

// Default account
const DEFAULT_ACCOUNT_ID = "default";

// Store runtime state
const runtimeState = new Map<string, TunnelRuntime>();

function getRuntime(accountId: string): TunnelRuntime {
  if (!runtimeState.has(accountId)) {
    runtimeState.set(accountId, {
      tunnel: null,
      lastError: null,
      lastConnectedAt: null,
    });
  }
  return runtimeState.get(accountId)!;
}

/**
 * Resolve tunnel account from config
 */
function resolveTunnelAccount(
  cfg: Record<string, unknown>,
  accountId?: string
): TunnelAccount {
  const effectiveAccountId = accountId || DEFAULT_ACCOUNT_ID;
  const accounts = ((cfg.channels as Record<string, unknown>)?.tunnel as Record<string, unknown>)?.accounts as Record<string, unknown>;
  const baseConfig = ((cfg.channels as Record<string, unknown>)?.tunnel as Record<string, unknown>);
  
  const account = (accounts?.[effectiveAccountId] || {}) as Record<string, unknown>;
  const serverUrl = (account.serverUrl as string) || (baseConfig?.serverUrl as string) || "";
  const apiKey = (account.apiKey as string) || (baseConfig?.apiKey as string) || "";
  
  return {
    accountId: effectiveAccountId,
    name: (account.name as string) || "Tunnel",
    enabled: (account.enabled as boolean) ?? (baseConfig?.enabled as boolean) ?? true,
    configured: Boolean(serverUrl && apiKey),
    serverUrl,
    apiKey,
    botIds: (account.botIds as string[]) || (baseConfig?.botIds as string[]) || [],
  };
}

// Plugin definition
export const tunnelPlugin: ChannelPlugin<TunnelAccount> = {
  id: "tunnel",
  meta: tunnelMeta,
  capabilities: tunnelCapabilities,
  
  configSchema: TunnelConfigSchema,
  
  config: {
    listAccountIds: (cfg) => {
      const accounts = ((cfg.channels as Record<string, unknown>)?.tunnel as Record<string, unknown>)?.accounts;
      if (accounts && typeof accounts === "object") {
        return Object.keys(accounts).filter((id) => id !== DEFAULT_ACCOUNT_ID);
      }
      return [];
    },
    
    resolveAccount: (cfg, accountId) => 
      resolveTunnelAccount(cfg, accountId),
    
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      const key = accountId || DEFAULT_ACCOUNT_ID;
      const accounts = { ...((cfg.channels as Record<string, unknown>)?.tunnel as Record<string, unknown>)?.accounts };
      const existing = (accounts[key] as Record<string, unknown>) || {};
      
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          tunnel: {
            ...(cfg.channels as Record<string, unknown>)?.tunnel,
            accounts: {
              ...accounts,
              [key]: { ...existing, enabled },
            },
          },
        },
      };
    },
    
    isConfigured: (account) => account.configured,
    
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      serverUrl: account.serverUrl,
    }),
  },
  
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastError: null,
      lastConnectedAt: null,
    },
    
    collectStatusIssues: () => [],
    
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastError: snapshot.lastError ?? null,
      lastConnectedAt: snapshot.lastConnectedAt ?? null,
    }),
    
    buildAccountSnapshot: ({ account, runtime }) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastError: runtime?.lastError ?? null,
      lastConnectedAt: runtime?.lastConnectedAt ?? null,
      serverUrl: account.serverUrl,
    }),
  },
  
  outbound: {
    deliveryMode: "gateway",
    chunker: (text, limit) => {
      const chunks: string[] = [];
      if (text.length <= limit) {
        chunks.push(text);
      } else {
        // Simple chunking by words
        const words = text.split(" ");
        let current = "";
        for (const word of words) {
          if ((current + " " + word).length > limit) {
            if (current) chunks.push(current);
            current = word;
          } else {
            current = current ? current + " " + word : word;
          }
        }
        if (current) chunks.push(current);
      }
      return chunks;
    },
    chunkerMode: "text",
    textChunkLimit: 4000,
    
    resolveTarget: ({ to, allowFrom }) => {
      if (!to) {
        return {
          ok: false,
          error: "Tunnel: Missing bot ID",
        };
      }
      return { ok: true, to };
    },
    
    sendText: async ({ to, text, accountId }) => {
      const runtime = getRuntime(accountId || DEFAULT_ACCOUNT_ID);
      
      if (!runtime.tunnel || !runtime.tunnel.isConnected()) {
        throw new Error("Tunnel not connected");
      }
      
      const result = await runtime.tunnel.sendMessage(to, text);
      return {
        channel: "tunnel",
        messageId: result.messageId,
        delivered: result.delivered,
      };
    },
    
    sendMedia: async () => {
      throw new Error("Tunnel channel does not support media");
    },
  },
  
  gateway: {
    startAccount: async (ctx) => {
      const account = resolveTunnelAccount(ctx.cfg, ctx.accountId);
      
      if (!account.configured) {
        ctx.log?.warn("Tunnel not configured, skipping");
        return;
      }
      
      const validation = validateTunnelConfig({
        serverUrl: account.serverUrl,
        apiKey: account.apiKey,
        botIds: account.botIds,
      });
      
      if (!validation.valid) {
        ctx.log?.error("Invalid tunnel config", { errors: validation.errors });
        return;
      }
      
      ctx.log?.info(`[${account.accountId}] Connecting to tunnel: ${account.serverUrl}`);
      
      const tunnel = new TunnelConnection({
        serverUrl: account.serverUrl,
        apiKey: account.apiKey,
        botIds: account.botIds,
      });
      
      const runtime = getRuntime(account.accountId);
      runtime.tunnel = tunnel;
      
      // Set up event handlers
      tunnel.on("connected", () => {
        ctx.log?.info(`[${account.accountId}] Connected to tunnel`);
        runtime.lastConnectedAt = Date.now();
        runtime.lastError = null;
        
        // Register bots
        if (ctx.runtime?.bots) {
          for (const bot of ctx.runtime.bots) {
            const botId = bot.id || `bot_${uuidv4().slice(0, 8)}`;
            tunnel.registerBot(botId, bot.name || "Bot", "openclaw", []);
          }
        }
        
        ctx.setStatus({ running: true });
      });
      
      tunnel.on("disconnected", (reason) => {
        ctx.log?.warn(`[${account.accountId}] Disconnected from tunnel: ${reason}`);
        ctx.setStatus({ running: false });
      });
      
      tunnel.on("error", (error) => {
        ctx.log?.error(`[${account.accountId}] Tunnel error: ${error.message}`);
        runtime.lastError = error.message;
        ctx.setStatus({ lastError: error.message });
      });
      
      tunnel.on("message", (msg) => {
        // Route incoming messages to appropriate handler
        ctx.log?.debug(`[${account.accountId}] Received message type: ${msg.type}`);
        
        if (msg.type === "message") {
          const data = msg.data as Record<string, unknown>;
          const from = data.from as string;
          const to = data.to as string;
          const text = data.text as string;
          
          ctx.log?.info(`[${account.accountId}] Message from ${from} to ${to}: ${text?.substring(0, 50)}...`);
        }
      });
      
      try {
        await tunnel.connect();
      } catch (error) {
        const err = error as Error;
        ctx.log?.error(`[${account.accountId}] Failed to connect: ${err.message}`);
        runtime.lastError = err.message;
        return;
      }
    },
    
    logoutAccount: async ({ accountId, cfg }) => {
      const runtime = getRuntime(accountId || DEFAULT_ACCOUNT_ID);
      
      if (runtime.tunnel) {
        runtime.tunnel.disconnect();
        runtime.tunnel = null;
      }
      
      return { cleared: true };
    },
  },
};

export default tunnelPlugin;
