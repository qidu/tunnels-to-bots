# Technical Plan: OpenClaw Mobile Channel via Tunnel

**Date:** 2026-02-10
**Author:** Clawra
**Goal:** Design a new channel solution enabling mobile web/app clients to connect to remote OpenClaw (Clawdbot) via tunnels

---

## Executive Summary

Design a new OpenClaw channel plugin called "clawdbot" or "mobile-tunnel" that enables:
1. Mobile web browser or native app clients to connect to home OpenClaw
2. Real-time chat messaging via WebSocket
3. Task assignment to AI agents
4. Support for multiple tunnel backends (frp, Cloudflare, ngrok, Tailscale)

---

## Part 1: Tunnel Solutions Analysis

### 1.1 frp (Fast Reverse Proxy by fatedier)

**Architecture:**
```
[Mobile Client] → [frp Server (VPS)] ← [frpc (Home)] ← [OpenClaw]
                        ↓
                    Public URL
```

**Protocol Support:**
- TCP/UDP tunnels
- HTTP/HTTPS virtual hosts
- **WebSocket:** ✅ Full support (X-WebSocket-Location header)
- STCP (secret TCP) for security
- xtcp (P2P mode)

**Security:**
- Token-based authentication
- TLS encryption (optional)
- Port allowlisting
- OIDC authentication plugin

**Performance:**
- Written in Go (high performance)
- Low latency (~10-50ms)
- Minimal overhead

**Pros:**
- ✅ Fully self-hosted (no SaaS dependency)
- ✅ Unlimited tunnels on free tier
- ✅ WebSocket support
- ✅ No bandwidth limits
- ✅ Full control over server

**Cons:**
- ❌ Requires own VPS ($5-10/month)
- ❌ Self-managed (updates, security)
- ❌ No built-in TLS (needs nginx/Caddy)
- ❌ Initial setup complexity

**Cost:** ~$5-10/month for VPS

---

### 1.2 Cloudflare Zero Trust Tunnel (cloudflared)

**Architecture:**
```
[Mobile Client] → [Cloudflare Edge] → [cloudflared (Home)] → [OpenClaw]
                           ↓
                        HTTPS
```

**Protocol Support:**
- HTTP/2, HTTP/3 (QUIC)
- **WebSocket:** ✅ Native support
- TCP tunnels
- SSH, RDP, SMB forwarding

**Security:**
- Zero Trust network access (mTLS)
- Device posture checks
- OAuth/OIDC integration
- Cloudflare WAF + DDoS protection
- Browser/renderer isolation available

**Performance:**
- Global CDN network
- Smart routing
- Automatic failover
- ~20-50ms latency

**Pros:**
- ✅ Enterprise-grade security
- ✅ Zero trust model
- ✅ Free tier generous (100 users/month active)
- ✅ Automatic TLS
- ✅ DDoS protection

**Cons:**
- ❌ Requires Cloudflare account
- ❌ Free tier has limits (100 users/month active)
- ❌ Traffic through Cloudflare (privacy concern)
- ❌ Account dependency

**Cost:** Free (up to 100 users), $3/user/month beyond

---

### 1.3 ngrok

**Architecture:**
```
[Mobile Client] → [ngrok Cloud] → [ngrok Agent (Home)] → [OpenClaw]
                           ↓
                    ngrok.io domain
```

**Protocol Support:**
- HTTP/HTTPS
- **WebSocket:** ✅ With paid plans
- TCP tunnels
- TLS passthrough

**Security:**
- OAuth/SSO integration
- IP restrictions
- Basic auth
- mTLS (paid)

**Performance:**
- Global network
- ~30-60ms latency

**Pros:**
- ✅ Easiest setup (30 seconds)
- ✅ Web UI for inspection
- ✅ Replay requests

**Cons:**
- ❌ Free tier limitations (1 online tunnel, random subdomain)
- ❌ No WebSocket on free tier
- ❌ Paid for custom domains/features
- ❌ Vendor lock-in

**Cost:** Free (limited), $7.50+/month for paid features

---

### 1.4 Comparison Matrix

| Feature | frp | Cloudflare | ngrok | Tailscale |
|---------|-----|------------|-------|-----------|
| **Protocols** | | | | |
| WebSocket | ✅ | ✅ | ✅* | ✅ |
| HTTPS/TLS | Optional | ✅ Native | ✅ | ✅ |
| TCP | ✅ | ✅ | ✅ | ✅ |
| **Security** | | | | |
| Zero Trust | ❌ | ✅ | ❌ | ✅** |
| mTLS | ❌ | ✅ | ✅*** | ✅ |
| Token Auth | ✅ | ✅ | ✅ | ✅ |
| **Cost** | | | | |
| Free Tier | Unlimited | 100 users/mo | 1 tunnel | Unlimited |
| Self-hosted | ✅ | ❌ | ❌ | ✅ |
| **Performance** | | | | |
| Latency | 10-50ms | 20-50ms | 30-60ms | 10-30ms |
| **Mobile Fit** | | | | |
| NAT Traversal | Good | Excellent | Good | Excellent |
| Reconnection | Manual | Auto | Auto | Auto |
| Battery Impact | Low | Low | Low | Low |

*ngrok: WebSocket requires paid plan
**Tailscale: Tailscale Funnel for inbound
***ngrok: mTLS requires Enterprise

---

### 1.5 Recommendation for Mobile Channel

**Primary: Cloudflare Zero Trust Tunnel**
- Best for mobile (auto-reconnect, low battery)
- Zero Trust security model
- Free tier sufficient for personal use
- Native WebSocket support

**Secondary (Privacy-Focused): frp**
- Self-hosted only (no cloud dependency)
- Full control over data
- No usage limits

**Tertiary: Tailscale**
- If already using Tailscale for VPN
- Mesh network benefits
- Free for personal use

---

## Part 2: OpenClaw Gateway Architecture Analysis

### 2.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        OpenClaw Gateway                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐  │
│  │  WhatsApp │ │ Telegram  │ │  Discord  │ │ Voice-Call  │  │
│  │  Plugin   │ │  Plugin   │ │  Plugin   │ │  Plugin     │  │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────┬──────┘  │
│        │             │             │                │         │
│        └─────────────┴──────┬──────┴────────────────┘         │
│                             ↓                                  │
│                    Gateway Protocol Layer                      │
│                  (WebSocket + REST + Event Bus)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    Local Network (127.0.0.1:18789)
```

### 2.2 Channel Plugin Structure

Each channel plugin follows this pattern (`extensions/*/src/channel.ts`):

```typescript
export const somePlugin: ChannelPlugin<ResolvedAccount> = {
  id: "channel-name",
  meta: {
    id: "channel-name",
    label: "Channel Name",
    blurb: "Short description",
    docsPath: "/channels/channel-name",
  },
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true/false,
    reactions: true/false,
    // ...
  },
  configSchema: buildChannelConfigSchema(ChannelConfigSchema),
  config: {
    listAccountIds: () => [...],
    resolveAccount: (cfg, accountId) => ResolvedAccount,
    // ...
  },
  messaging: {
    normalizeTarget: (target) => string,
    targetResolver: { ... },
  },
  outbound: {
    deliveryMode: "direct" | "queue",
    sendText: async ({ to, text, accountId }) => void,
    // ...
  },
  inbound: {
    // Handle incoming messages
  },
};
```

### 2.3 Existing Tunnel Support (Voice-Call Reference)

From `extensions/voice-call/src/tunnel.ts`:

```typescript
export interface TunnelConfig {
  provider: "ngrok" | "tailscale-serve" | "tailscale-funnel" | "none";
  port: number;
  path: string;
  ngrokAuthToken?: string;
  ngrokDomain?: string;
}

export async function startTunnel(config: TunnelConfig): Promise<TunnelResult | null> {
  // Supports ngrok, tailscale-serve, tailscale-funnel
}
```

### 2.4 Gateway Protocol Layer

**Communication Methods:**
1. **WebSocket:** `ws://127.0.0.1:18789/ws` - Real-time bidirectional
2. **REST:** `http://127.0.0.1:18789/message` - Outbound messages
3. **Events:** Server-Sent Events / WebSocket events

**Key Endpoints:**
```
GET  /status              - Gateway status
POST /message             - Send message
GET  /sessions            - List sessions
POST /sessions/:id/send   - Send to session
```

---

## Part 3: New Channel Design: "Mobile-Tunnel" or "Clawdbot"

### 3.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Mobile Client (Web/App)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  Web Chat   │  │  Task List  │  │  Settings   │               │
│  │   UI        │  │   UI        │  │   UI        │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         ↓                 ↓                 ↓                      │
│    WebSocket (wss://your-tunnel-domain/ws)                        │
└──────────────────────────────────────────────────────────────────┘
                              ↑
                              │ Tunnel (frp/cloudflare/ngrok)
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                      Home Network                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    OpenClaw Gateway                          │ │
│  │  ┌─────────────────────────────────────────────────────┐    │ │
│  │  │            mobile-tunnel Channel Plugin             │    │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────────────────────┐ │    │ │
│  │  │  │ WebSocket│ │ Session │ │ Task Queue             │ │    │ │
│  │  │  │ Handler │ │ Manager │ │ Dispatcher              │ │    │ │
│  │  │  └─────────┘ └─────────┘ └─────────────────────────┘ │    │ │
│  │  └─────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              ↓                                    │
│                    Local AI Agent (Clawra)                         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Channel Plugin Structure

**File Structure:**
```
extensions/mobile-tunnel/
├── src/
│   ├── channel.ts              # Main plugin entry
│   ├── config-schema.ts        # Configuration schema
│   ├── handlers/
│   │   ├── ws-handler.ts       # WebSocket connection handler
│   │   ├── session-manager.ts  # Session lifecycle
│   │   ├── message-router.ts   # Message routing
│   │   └── task-dispatcher.ts  # Task assignment
│   ├── types.ts                # TypeScript types
│   ├── auth.ts                 # Authentication middleware
│   ├── tunnel.ts               # Tunnel integration (frp/cloudflare)
│   └── monitoring.ts           # Health checks, metrics
├── openclaw.plugin.json        # Plugin metadata
├── package.json                # Dependencies
└── README.md                   # Documentation
```

### 3.3 Core Type Definitions

```typescript
// src/types.ts

export interface MobileTunnelConfig {
  /** Tunnel provider: frp, cloudflare, ngrok, tailscale */
  provider: "frp" | "cloudflare" | "ngrok" | "tailscale" | "none";

  /** Local port for WebSocket server */
  localPort: number;

  /** Path for WebSocket endpoint */
  wsPath: string;

  /** frp configuration */
  frp?: {
    serverAddr: string;
    serverPort: number;
    authToken: string;
    tunnelName: string;
    protocol: "http" | "https" | "tcp";
  };

  /** Cloudflare configuration */
  cloudflare?: {
    tunnelName: string;
    credentialsPath: string;
  };

  /** ngrok configuration */
  ngrok?: {
    authToken: string;
    domain?: string;
  };

  /** Authentication */
  auth: {
    /** API key for mobile clients */
    apiKey?: string;
    /** JWT secret for token validation */
    jwtSecret?: string;
    /** Allowed user IDs */
    allowedUsers?: string[];
  };

  /** Session settings */
  sessions: {
    /** Session timeout in seconds */
    timeout: number;
    /** Max concurrent sessions */
    maxSessions: number;
    /** Enable task queue */
    enableTaskQueue: boolean;
  };
}

export interface ResolvedMobileAccount {
  accountId: string;
  configured: boolean;
  enabled: boolean;
  publicUrl?: string;
}

export interface MobileClientMessage {
  type: "chat" | "task" | "status" | "command";
  payload: Record<string, unknown>;
  timestamp: string;
  clientId: string;
}

export interface ChatMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
  replyTo?: string;
  attachments?: Attachment[];
}

export interface TaskAssignment {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
}

export interface WebSocketFrame {
  type: "message" | "heartbeat" | "auth" | "status" | "error";
  data: unknown;
  timestamp: number;
}
```

### 3.4 Main Channel Plugin

```typescript
// src/channel.ts

import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import { MobileTunnelConfigSchema } from "./config-schema.js";
import { MobileTunnelClient } from "./client.js";
import type { MobileTunnelConfig, ResolvedMobileAccount } from "./types.js";

const meta = {
  id: "mobile-tunnel",
  label: "Mobile Tunnel",
  selectionLabel: "Mobile Client (Clawdbot)",
  detailLabel: "Clawdbot",
  docsPath: "/channels/mobile-tunnel",
  docsLabel: "mobile-tunnel",
  blurb: "Mobile web/app client via WebSocket tunnel",
  systemImage: "iphone",
  aliases: ["clawdbot", "mobile"],
};

export const mobileTunnelPlugin: ChannelPlugin<ResolvedMobileAccount> = {
  id: "mobile-tunnel",
  meta,
  capabilities: {
    chatTypes: ["direct"],
    media: true,
    reactions: false,
    edit: false,
    unsend: false,
    reply: true,
    effects: false,
    groupManagement: false,
  },
  reload: { configPrefixes: ["channels.mobile-tunnel"] },
  configSchema: buildChannelConfigSchema(MobileTunnelConfigSchema),

  config: {
    listAccountIds: () => ["default"],
    resolveAccount: (cfg) => ({
      accountId: "default",
      configured: true,
      enabled: cfg.channels?.["mobile-tunnel"]?.enabled ?? true,
      publicUrl: cfg.channels?.["mobile-tunnel"]?.publicUrl,
    }),
    defaultAccountId: () => "default",
    setAccountEnabled: () => {},
    deleteAccount: () => {},
    isConfigured: (account) => account.configured && account.enabled,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: "Clawdbot Mobile",
      enabled: account.enabled,
      configured: account.configured,
      publicUrl: account.publicUrl,
    }),
  },

  messaging: {
    normalizeTarget: (target) => target.trim(),
    targetResolver: {
      looksLikeId: (input) => /^[a-zA-Z0-9_-]+$/.test(input.trim()),
      hint: "<device-id|client-id>",
    },
  },

  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 10000,
    sendText: async ({ to, text, replyToId, accountId }) => {
      const client = getMobileClient();
      await client.sendMessage({
        type: "chat",
        to,
        text,
        replyTo: replyToId,
      });
    },
  },

  // Start/stop WebSocket server and tunnel
  setup: async ({ cfg, lifecycle }) => {
    const config = cfg.channels?.["mobile-tunnel"];
    if (!config?.enabled) return;

    const client = new MobileTunnelClient(config);
    await client.start();

    lifecycle.onShutdown(async () => {
      await client.stop();
    });
  },
};

// Singleton instance
let mobileClient: MobileTunnelClient | null = null;

function getMobileClient(): MobileTunnelClient {
  if (!mobileClient) {
    throw new Error("Mobile tunnel not initialized");
  }
  return mobileClient;
}
```

### 3.5 WebSocket Handler

```typescript
// src/handlers/ws-handler.ts

import { WebSocketServer, WebSocket } from "ws";
import type { MobileTunnelConfig } from "../types.js";
import { AuthMiddleware } from "../auth.js";
import { SessionManager } from "./session-manager.js";
import { MessageRouter } from "./message-router.js";

export class WebSocketHandler {
  private server: WebSocketServer | null = null;
  private auth: AuthMiddleware;
  private sessions: SessionManager;
  private router: MessageRouter;

  constructor(private config: MobileTunnelConfig) {
    this.auth = new AuthMiddleware(config.auth);
    this.sessions = new SessionManager(config.sessions);
    this.router = new MessageRouter();
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = new WebSocketServer({
        port: this.config.localPort,
        path: this.config.wsPath,
      });

      this.server.on("listening", () => {
        console.log(`[mobile-tunnel] WebSocket server listening on port ${this.config.localPort}`);
        resolve();
      });

      this.server.on("connection", (ws: WebSocket, req) => {
        this.handleConnection(ws, req);
      });

      this.server.on("error", (err) => {
        console.error("[mobile-tunnel] WebSocket error:", err);
      });
    });
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    // Extract auth token from query or header
    const url = new URL(req.url || "", `http://localhost:${this.config.localPort}`);
    const token = url.searchParams.get("token") || req.headers["authorization"];

    // Authenticate
    const userId = await this.auth.authenticate(token);
    if (!userId) {
      this.sendError(ws, 401, "Unauthorized");
      ws.close();
      return;
    }

    // Create session
    const session = await this.sessions.create(ws, userId);
    console.log(`[mobile-tunnel] Client connected: ${userId}`);

    // Send welcome
    this.send(ws, {
      type: "status",
      data: {
        status: "connected",
        userId,
        timestamp: Date.now(),
      },
    });

    // Message handler
    ws.on("message", async (data) => {
      await this.handleMessage(session, data.toString());
    });

    // Disconnect handler
    ws.on("close", () => {
      this.sessions.remove(session.id);
      console.log(`[mobile-tunnel] Client disconnected: ${userId}`);
    });

    // Heartbeat
    ws.on("pong", () => {
      session.lastPing = Date.now();
    });

    // Start heartbeat interval
    session.heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
  }

  private async handleMessage(session: ClientSession, rawData: string): Promise<void> {
    try {
      const frame = JSON.parse(rawData) as WebSocketFrame;

      switch (frame.type) {
        case "chat":
          await this.router.routeChat(session, frame.data);
          break;
        case "task":
          await this.router.routeTask(session, frame.data);
          break;
        case "status":
          await this.handleStatusRequest(session, frame.data);
          break;
        default:
          this.sendError(session.ws, 400, "Unknown frame type");
      }
    } catch (error) {
      this.sendError(session.ws, 400, `Invalid message: ${error}`);
    }
  }

  private send(ws: WebSocket, frame: WebSocketFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame));
    }
  }

  private sendError(ws: WebSocket, code: number, message: string): void {
    this.send(ws, {
      type: "error",
      data: { code, message },
      timestamp: Date.now(),
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
```

### 3.6 Task Dispatcher

```typescript
// src/handlers/task-dispatcher.ts

import { v4 as uuidv4 } from "uuid";
import type { TaskAssignment, ClientSession } from "../types.js";

export class TaskDispatcher {
  private taskQueue: Map<string, TaskAssignment> = new Map();
  private sessionTasks: Map<string, Set<string>> = new Map();

  async submitTask(session: ClientSession, taskData: {
    title: string;
    description: string;
    priority: string;
    dueDate?: string;
  }): Promise<TaskAssignment> {
    const task: TaskAssignment = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority as TaskAssignment["priority"],
      assignedTo: "agent:main", // Default to main agent
      dueDate: taskData.dueDate,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // Store task
    this.taskQueue.set(task.id, task);

    // Track session ownership
    if (!this.sessionTasks.has(session.id)) {
      this.sessionTasks.set(session.id, new Set());
    }
    this.sessionTasks.get(session.id)!.add(task.id);

    // Send to OpenClaw session
    await this.sendToAgent(task);

    return task;
  }

  async getTaskStatus(taskId: string): Promise<TaskAssignment | null> {
    return this.taskQueue.get(taskId) || null;
  }

  async listSessionTasks(sessionId: string): Promise<TaskAssignment[]> {
    const taskIds = this.sessionTasks.get(sessionId);
    if (!taskIds) return [];
    return Array.from(taskIds).map((id) => this.taskQueue.get(id)!).filter(Boolean);
  }

  async updateTaskStatus(taskId: string, status: TaskAssignment["status"]): Promise<void> {
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.status = status;
      // Notify relevant sessions...
    }
  }

  private async sendToAgent(task: TaskAssignment): Promise<void> {
    // This would integrate with OpenClaw's session system
    // Using openclaw SDK to create a task or send to agent
    const payload = JSON.stringify({
      kind: "agentTurn",
      message: `New task assigned: ${task.title}\n\n${task.description}\n\nPriority: ${task.priority}`,
      deliver: true,
    });

    // Use internal API or message system
    // fetch("http://127.0.0.1:18789/sessions/main/send", { ... })
  }
}
```

### 3.7 Tunnel Integration (Reusable from Voice-Call)

```typescript
// src/tunnel.ts

import type { TunnelConfig } from "openclaw/plugin-sdk";
import {
  startNgrokTunnel,
  isNgrokAvailable,
} from "openclaw/extensions/voice-call/src/tunnel.js";

export async function startMobileTunnel(
  config: MobileTunnelConfig
): Promise<{ publicUrl: string; stop: () => Promise<void> } | null> {
  if (config.provider === "none") {
    return null;
  }

  switch (config.provider) {
    case "ngrok":
      return startNgrokTunnel({
        port: config.localPort,
        path: config.wsPath,
        authToken: config.ngrok?.authToken,
        domain: config.ngrok?.domain,
      });

    case "cloudflare":
      return startCloudflareTunnel(config.cloudflare!);

    case "frp":
      return startFrpTunnel(config.frp!);

    case "tailscale":
      return startTailscaleTunnel(config);

    default:
      return null;
  }
}

// Cloudflare implementation (stub)
async function startCloudflareTunnel(config: {
  tunnelName: string;
  credentialsPath: string;
}): Promise<{ publicUrl: string; stop: () => Promise<void> }> {
  // Spawn cloudflared process
  const proc = spawn("cloudflared", [
    "tunnel",
    "--name", config.tunnelName,
    "--credentials-file", config.credentialsPath,
    "run",
  ]);

  // Parse URL from output...
  return {
    publicUrl: `https://${config.tunnelName}.trycloudflare.com`,
    stop: async () => proc.kill(),
  };
}

// frp implementation (stub)
async function startFrpTunnel(config: {
  serverAddr: string;
  serverPort: number;
  authToken: string;
  tunnelName: string;
  protocol: string;
}): Promise<{ publicUrl: string; stop: () => Promise<void> }> {
  // Write frpc.ini and spawn frpc
  const frpcConfig = `
[common]
server_addr = ${config.serverAddr}
server_port = ${config.serverPort}
token = ${config.authToken}

[${config.tunnelName}]
type = ${config.protocol}
local_ip = 127.0.0.1
local_port = ${config.localPort}
`;

  // Write to temp file and run frpc...
  return {
    publicUrl: `http://${config.tunnelName}.frp.example.com`,
    stop: async () => proc.kill(),
  };
}
```

---

## Part 4: Mobile Client Design

### 4.1 Web Client Architecture

```
mobile-clawdbot/
├── index.html           # Entry point
├── src/
│   ├── main.tsx         # App root
│   ├── App.tsx          # Main component
│   ├── components/
│   │   ├── ChatView.tsx      # Chat interface
│   │   ├── TaskList.tsx      # Task management
│   │   ├── TaskDetail.tsx    # Task creation/editing
│   │   ├── Settings.tsx      # Settings panel
│   │   └── ConnectionStatus.tsx
│   ├── services/
│   │   ├── websocket.ts  # WebSocket client
│   │   ├── auth.ts       # Authentication
│   │   └── api.ts        # REST API wrapper
│   ├── stores/
│   │   ├── chatStore.ts  # Chat messages
│   │   ├── taskStore.ts  # Tasks
│   │   └── appStore.ts   # App state
│   └── types/
│       └── index.ts      # TypeScript types
├── public/
│   └── manifest.json     # PWA manifest
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

### 4.2 WebSocket Client Service

```typescript
// src/services/websocket.ts

import type { WebSocketFrame, ChatMessage, TaskAssignment } from "../types";

type FrameHandler = (frame: WebSocketFrame) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectInterval = 5000;
  private maxReconnectAttempts = 10;
  private reconnectAttempts = 0;
  private handlers: Map<string, FrameHandler[]> = new Map();
  private isConnected = false;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const fullUrl = `${this.url}?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(fullUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit("status", { status: "connected" });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const frame = JSON.parse(event.data) as WebSocketFrame;
          this.emit(frame.type, frame);
          this.emit("*", frame); // Catch-all
        } catch (error) {
          console.error("Failed to parse frame:", error);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit("status", { status: "disconnected" });
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", { message: "Max reconnection attempts reached" });
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect().catch(() => {});
    }, this.reconnectInterval);
  }

  send(frame: Omit<WebSocketFrame, "timestamp">): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected");
    }

    const fullFrame: WebSocketFrame = {
      ...frame,
      timestamp: Date.now(),
    } as WebSocketFrame;

    this.ws.send(JSON.stringify(fullFrame));
  }

  // Convenience methods
  sendChat(text: string, replyTo?: string): void {
    this.send({
      type: "message",
      data: {
        text,
        replyTo,
        type: "chat",
      },
    });
  }

  submitTask(task: {
    title: string;
    description: string;
    priority: string;
    dueDate?: string;
  }): void {
    this.send({
      type: "message",
      data: {
        type: "task",
        ...task,
      },
    });
  }

  requestStatus(): void {
    this.send({
      type: "status",
      data: { request: "full" },
    });
  }

  // Event system
  on(type: string, handler: FrameHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: FrameHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(type: string, data: WebSocketFrame): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

### 4.3 PWA Manifest

```json
// public/manifest.json
{
  "name": "Clawdbot Mobile",
  "short_name": "Clawdbot",
  "description": "Mobile client for OpenClaw AI Assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#7c3aed",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Part 5: Security Considerations

### 5.1 Authentication Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Mobile App  │────▶│  Generate Token  │────▶│  Validate &     │
│             │     │  (API Key/JWT)   │     │  Store in       │
│             │     │                  │     │  mobile-tunnel  │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           ↑                         ↓
                      Store locally            Check on each
                                                   connection
```

### 5.2 Security Measures

1. **Token Authentication**
   - API key or JWT tokens
   - Token rotation support
   - Expiry dates

2. **Connection Security**
   - TLS for tunnel (HTTPS/WSS)
   - mTLS for Cloudflare Enterprise

3. **Rate Limiting**
   - Per-connection message limits
   - Burst protection

4. **Data Validation**
   - Schema validation for all messages
   - Sanitize user input

5. **Session Management**
   - Session timeout (configurable)
   - Automatic cleanup
   - Maximum concurrent sessions

### 5.3 Configuration Example

```json
{
  "channels": {
    "mobile-tunnel": {
      "enabled": true,
      "provider": "cloudflare",
      "localPort": 3000,
      "wsPath": "/ws",
      "cloudflare": {
        "tunnelName": "clawdbot-home",
        "credentialsPath": "~/.cloudflared/credentials.json"
      },
      "auth": {
        "apiKey": "your-api-key-here",
        "jwtSecret": "your-jwt-secret",
        "allowedUsers": ["user1", "user2"]
      },
      "sessions": {
        "timeout": 3600,
        "maxSessions": 10
      }
    }
  }
}
```

---

## Part 6: Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create extension structure (`extensions/mobile-tunnel/`)
- [ ] Implement ChannelPlugin interface
- [ ] Build WebSocket server handler
- [ ] Create basic message routing

### Phase 2: Authentication & Security (Week 2)
- [ ] Implement token-based auth
- [ ] Add session management
- [ ] Configure rate limiting
- [ ] Add input validation

### Phase 3: Tunnel Integration (Week 3)
- [ ] Integrate ngrok tunnel (reuse voice-call code)
- [ ] Add Cloudflare tunnel support
- [ ] Add frp tunnel support
- [ ] Create tunnel auto-start on gateway

### Phase 4: Task System (Week 4)
- [ ] Build task queue system
- [ ] Create OpenClaw session integration
- [ ] Implement task status updates
- [ ] Add notification system

### Phase 5: Mobile Client (Week 5-6)
- [ ] Build React web app
- [ ] Implement PWA features
- [ ] Create chat interface
- [ ] Build task management UI
- [ ] Add connection status indicator

### Phase 6: Testing & Polish (Week 7)
- [ ] Security audit
- [ ] Performance testing
- [ ] Mobile browser testing
- [ ] Documentation

---

## Part 7: Dependencies

### OpenClaw Plugin Dependencies

```json
{
  "dependencies": {
    "@buape/carbon": "^0.25.0",
    "openclaw/plugin-sdk": "workspace:*",
    "ws": "^8.16.0",
    "uuid": "^9.0.0",
    "jsonwebtoken": "^9.0.0"
  }
}
```

### Mobile Client Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "react-query": "^3.39.0",
    "lucide-react": "^0.330.0"
  },
  "devDependencies": {
    "vite": "^5.1.0",
    "tailwindcss": "^3.4.0",
    "@types/react": "^18.2.0",
    "@types/ws": "^8.5.0"
  }
}
```

---

## Appendix A: Reference Implementations

### Existing Tunnel Code
- `extensions/voice-call/src/tunnel.ts` - ngrok, Tailscale integration
- `extensions/whatsapp/src/runtime.ts` - Channel runtime pattern
- `extensions/nostr/src/channel.ts` - WebSocket-based channel

### Documentation
- OpenClaw Docs: https://docs.openclaw.ai
- Cloudflare Zero Trust: https://developers.cloudflare.com/cloudflare-one/
- frp Documentation: https://github.com/fatedier/frp
- ngrok Documentation: https://ngrok.com/docs

---

## Appendix B: FAQ

**Q: Why not use existing channels (Telegram, WhatsApp)?**
A: Those channels depend on third-party services. A custom mobile channel gives:
- Complete control over UI/UX
- No platform restrictions
- Direct WebSocket connection (low latency)
- Custom task management features
- Privacy (data stays on your machine)

**Q: Is this secure?**
A: Yes, with proper configuration:
- All traffic encrypted via TLS (through tunnel)
- Token-based authentication
- Rate limiting
- Session isolation

**Q: What about battery on mobile?**
A: WebSocket heartbeats are minimal (~50 bytes every 30s). Battery impact is negligible compared to other apps.

**Q: Can I use this offline?**
A: No - the tunnel requires internet to reach your home OpenClaw. However, messages queue locally and send when reconnected.

---

*Plan generated by Clawra on 2026-02-10*
*OpenClaw version: 2026.2.1*