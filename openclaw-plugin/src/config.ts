/**
 * Tunnel Channel Configuration Schema
 */

import type { ChannelConfigSchema } from "openclaw/dist/channels/plugins/types.plugin.d.ts";

export const TunnelConfigSchema: ChannelConfigSchema = {
  schema: {
    type: "object",
    required: ["serverUrl", "apiKey"],
    properties: {
      serverUrl: {
        type: "string",
        description: "Tunnel server WebSocket URL",
        examples: ["ws://tunnel.example.com:3000/ws"],
      },
      apiKey: {
        type: "string",
        description: "API key for authentication with tunnel server",
        format: "t2b_<userId>_<signature>",
      },
      botIds: {
        type: "array",
        items: { type: "string" },
        description: "List of bot IDs to expose (empty = all bots)",
        default: [],
      },
      tls: {
        type: "boolean",
        description: "Enable TLS/SSL for connection",
        default: true,
      },
      reconnectInterval: {
        type: "number",
        description: "Reconnect interval in milliseconds",
        default: 5000,
      },
      heartbeatInterval: {
        type: "number",
        description: "Heartbeat interval in milliseconds",
        default: 30000,
      },
    },
  },
  uiHints: {
    serverUrl: {
      label: "Tunnel Server URL",
      help: "WebSocket URL of the tunnel gateway",
      placeholder: "ws://tunnel.example.com:3000/ws",
    },
    apiKey: {
      label: "API Key",
      help: "Your tunnels-to-bots API key",
      sensitive: true,
      placeholder: "t2b_<userId>_<signature>",
    },
    botIds: {
      label: "Bot IDs",
      help: "Leave empty to expose all bots, or specify which bots to expose",
    },
  },
};

export function validateTunnelConfig(config: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!config.serverUrl || typeof config.serverUrl !== "string") {
    errors.push("serverUrl is required and must be a string");
  } else if (!config.serverUrl.startsWith("ws://") && !config.serverUrl.startsWith("wss://")) {
    errors.push("serverUrl must start with ws:// or wss://");
  }
  
  if (!config.apiKey || typeof config.apiKey !== "string") {
    errors.push("apiKey is required and must be a string");
  } else if (!config.apiKey.startsWith("t2b_")) {
    errors.push("apiKey must start with 't2b_'");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
