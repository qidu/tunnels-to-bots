/**
 * Tunnel Connection Manager
 * Handles WebSocket connection to tunnel gateway
 */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type { TunnelConfig, TunnelMessage, TunnelBotInfo, TunnelEvents } from "./types.js";

export class TunnelConnection extends EventEmitter<TunnelEvents> {
  private ws: WebSocket | null = null;
  private config: TunnelConfig;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connectedAt: number | null = null;
  private pendingMessages: Map<string, { resolve: (data: unknown) => void; reject: (err: Error) => void }> = new Map();
  
  constructor(config: TunnelConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      heartbeatInterval: 30000,
      tls: true,
      ...config,
    };
  }
  
  /**
   * Connect to tunnel gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.serverUrl);
      
      // Add auth token
      url.searchParams.set("token", this.config.apiKey);
      
      this.ws = new WebSocket(url.toString(), {
        timeout: 10000,
      });
      
      this.ws.on("open", () => {
        this.connectedAt = Date.now();
        this.startHeartbeat();
        this.emit("connected");
        resolve();
      });
      
      this.ws.on("message", (data) => {
        try {
          const frame = JSON.parse(data.toString());
          this.handleMessage(frame);
        } catch (e) {
          console.error("Failed to parse tunnel message:", e);
        }
      });
      
      this.ws.on("close", (code, reason) => {
        this.cleanup();
        this.emit("disconnected", reason.toString());
        this.scheduleReconnect();
      });
      
      this.ws.on("error", (error) => {
        this.emit("error", error);
        if (!this.connectedAt) {
          reject(error);
        }
      });
    });
  }
  
  /**
   * Disconnect from tunnel gateway
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }
  
  /**
   * Register a bot with the tunnel
   */
  registerBot(botId: string, name: string, type: string, capabilities: string[] = []): void {
    this.send({
      type: "register_bot",
      data: {
        botId,
        name,
        type,
        capabilities,
        registeredAt: new Date().toISOString(),
      },
    });
  }
  
  /**
   * Unregister a bot from the tunnel
   */
  unregisterBot(botId: string): void {
    this.send({
      type: "unregister_bot",
      data: { botId },
    });
  }
  
  /**
   * Send a message through the tunnel
   */
  sendMessage(to: string, text: string, metadata?: Record<string, unknown>): Promise<{
    messageId: string;
    delivered: boolean;
  }> {
    const messageId = uuidv4();
    
    return this.sendWithResponse({
      type: "message",
      data: {
        to,
        text,
        messageId,
        timestamp: Date.now(),
        ...metadata,
      },
    }, "message_ack", messageId);
  }
  
  /**
   * Send a task through the tunnel
   */
  sendTask(
    botId: string,
    title: string,
    description: string,
    priority: string
  ): Promise<{
    taskId: string;
    status: string;
  }> {
    const taskId = uuidv4();
    
    return this.sendWithResponse({
      type: "task",
      data: {
        botId,
        title,
        description,
        priority,
        taskId,
        createdAt: new Date().toISOString(),
      },
    }, "task_status", taskId);
  }
  
  /**
   * Get list of user's bots from tunnel
   */
  async listBots(): Promise<TunnelBotInfo[]> {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      
      this.send({
        type: "list_bots",
        data: { requestId },
      });
      
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(requestId);
        reject(new Error("Timeout waiting for bots list"));
      }, 5000);
      
      this.pendingMessages.set(requestId, {
        resolve: (data) => {
          clearTimeout(timeout);
          const bots = (data as { bots?: TunnelBotInfo[] })?.bots || [];
          resolve(bots);
        },
        reject,
      });
    });
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection statistics
   */
  getStats(): {
    connected: boolean;
    connectedAt: number | null;
    uptime: number;
  } {
    return {
      connected: this.isConnected(),
      connectedAt: this.connectedAt,
      uptime: this.connectedAt ? Date.now() - this.connectedAt : 0,
    };
  }
  
  private send(frame: TunnelMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...frame,
        timestamp: frame.timestamp || Date.now(),
        id: frame.id || uuidv4(),
      }));
    } else {
      console.warn("Tunnel not connected, message not sent");
    }
  }
  
  private async sendWithResponse<T>(
    frame: TunnelMessage,
    responseType: string,
    correlationId: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error("Not connected to tunnel"));
        return;
      }
      
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(correlationId);
        reject(new Error(`Timeout waiting for ${responseType}`));
      }, 10000);
      
      this.pendingMessages.set(correlationId, {
        resolve: (data) => {
          clearTimeout(timeout);
          resolve(data as T);
        },
        reject,
      });
      
      this.send(frame);
    });
  }
  
  private handleMessage(frame: Record<string, unknown>): void {
    const type = frame.type as string;
    const data = frame.data as Record<string, unknown>;
    
    // Handle responses
    if (frame.id && this.pendingMessages.has(frame.id as string)) {
      const pending = this.pendingMessages.get(frame.id as string)!;
      pending.resolve(data);
      this.pendingMessages.delete(frame.id as string);
      return;
    }
    
    // Handle events
    switch (type) {
      case "message":
        this.emit("message", frame as TunnelMessage);
        break;
        
      case "message_ack":
        if (data?.messageId && this.pendingMessages.has(data.messageId as string)) {
          const pending = this.pendingMessages.get(data.messageId as string)!;
          pending.resolve(data);
          this.pendingMessages.delete(data.messageId as string);
        }
        break;
        
      case "task_status":
        if (data?.taskId && this.pendingMessages.has(data.taskId as string)) {
          const pending = this.pendingMessages.get(data.taskId as string)!;
          pending.resolve(data);
          this.pendingMessages.delete(data.taskId as string);
        }
        this.emit("message", frame as TunnelMessage);
        break;
        
      case "status":
        if (data?.type === "bots_list") {
          const bots = (data as { bots?: TunnelBotInfo[] }).bots || [];
          bots.forEach((bot) => {
            this.emit("botRegistered", bot);
          });
        }
        break;
        
      case "bot_registered":
        this.emit("botRegistered", data as TunnelBotInfo);
        break;
        
      case "bot_unregistered":
        this.emit("botUnregistered", data?.botId as string);
        break;
        
      case "error":
        this.emit("error", new Error((data?.message as string) || "Unknown error"));
        break;
        
      default:
        this.emit("message", frame as TunnelMessage);
    }
  }
  
  private startHeartbeat(): void {
    const interval = this.config.heartbeatInterval || 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping", data: { timestamp: Date.now() } });
      }
    }, interval);
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const interval = this.config.reconnectInterval || 5000;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (e) {
        console.error("Reconnect failed:", e);
        this.scheduleReconnect();
      }
    }, interval);
  }
  
  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    // Reject pending messages
    this.pendingMessages.forEach((pending) => {
      pending.reject(new Error("Connection closed"));
    });
    this.pendingMessages.clear();
  }
}
