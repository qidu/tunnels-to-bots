/**
 * Tunnels-to-Bots JavaScript SDK
 * Client library for web and Node.js applications
 */

export { Client } from './client.js';
export { Auth } from './auth.js';
export { MessageBuilder } from './messages.js';
export type { 
  ClientOptions, 
  Message, 
  MessageFrame, 
  Task,
  Bot,
  ConnectionState 
} from './types.js';

/**
 * Quick start example
 * 
 * ```typescript
 * import { Client } from 'tunnels-to-bots-sdk';
 * 
 * const client = new Client({
 *   serverUrl: 'wss://your-server.com/ws',
 *   apiKey: 'your-api-key'
 * });
 * 
 * await client.connect();
 * 
 * client.on('message', (msg) => {
 *   console.log('Received:', msg.text);
 * });
 * 
 * client.sendMessage({
 *   to: 'bot_abc123',
 *   text: 'Hello Bot!'
 * });
 * ```
 */