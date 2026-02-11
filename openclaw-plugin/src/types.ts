/**
 * Types for Tunnels-to-Bots OpenClaw Plugin
 */

import type {
  ChannelCapabilities,
  ChannelId,
  ChannelMeta,
} from "openclaw/dist/channels/plugins/types.plugin.d.ts";

export interface TunnelConfig {
  /** Tunnel server WebSocket URL */
  serverUrl: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Bot IDs to register with the tunnel (empty = all bots) */
  botIds?: string[];
  
  ** Enable TLS/SSL */
  tls?: boolean;
  
  /** Reconnect interval in ms */
  reconnectInterval?: number;
  
  /** Heartbeat interval in ms */
  heartbeatInterval?: number;
}

export interface ResolvedTunnelAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  serverUrl: string;
  apiKey: string;
  botIds: string[];
}

export interface TunnelBotInfo {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline";
  capabilities: string[];
}

export interface TunnelMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp?: number;
  id?: string;
}

// Event types for tunnel connections
export interface TunnelEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  message: (msg: TunnelMessage) => void;
  error: (error: Error) => void;
  botRegistered: (bot: TunnelBotInfo) => void;
  botUnregistered: (botId: string) => void;
}

export const tunnelCapabilities: ChannelCapabilities = {
  chatTypes: ["direct"],
  reactions: false,
  threads: false,
  media: false,
  nativeCommands: false,
  blockStreaming: true,
};

export const tunnelMeta: ChannelMeta = {
  id: "tunnel" as ChannelId,
  displayName: "Tunnel Service",
  description: "Connect to tunnels-to-bots platform for remote bot access",
  vendor: "tunnels2bots",
};
