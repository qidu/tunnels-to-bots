/**
 * Message Builder
 * Helper class for constructing complex messages
 */

import type { TextMessage, MediaMessage, Task } from './types.js';
import { v4 as uuidv4 } from 'uuid';

interface MediaPayload {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType: string;
  size?: number;
  thumbnailUrl?: string;
  caption?: string;
  duration?: number;
}

interface TaskPayload {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  botId: string;
  dueDate?: string;
}

/**
 * Builder for text messages
 */
export class TextMessageBuilder {
  private to: string;
  private text: string;
  private replyTo?: string;
  private from?: string;
  private timestamp?: string;

  constructor(to: string, text: string) {
    this.to = to;
    this.text = text;
  }

  setReplyTo(messageId: string): this {
    this.replyTo = messageId;
    return this;
  }

  setFrom(userId: string): this {
    this.from = userId;
    return this;
  }

  setTimestamp(timestamp: string): this {
    this.timestamp = timestamp;
    return this;
  }

  build(): TextMessage {
    return {
      id: uuidv4(),
      from: this.from || 'user',
      to: this.to,
      type: 'text',
      text: this.text,
      contentType: 'plain',
      timestamp: this.timestamp || new Date().toISOString(),
      replyTo: this.replyTo,
    };
  }
}

/**
 * Builder for media messages
 */
export class MediaMessageBuilder {
  private to: string;
  private media: MediaPayload;
  private replyTo?: string;
  private from?: string;
  private timestamp?: string;

  constructor(to: string, media: MediaPayload) {
    this.to = to;
    this.media = media;
  }

  setReplyTo(messageId: string): this {
    this.replyTo = messageId;
    return this;
  }

  setFrom(userId: string): this {
    this.from = userId;
    return this;
  }

  setTimestamp(timestamp: string): this {
    this.timestamp = timestamp;
    return this;
  }

  build(): MediaMessage {
    return {
      id: uuidv4(),
      from: this.from || 'user',
      to: this.to,
      type: 'media',
      mediaType: this.media.type,
      url: this.media.url,
      mimeType: this.media.mimeType,
      size: this.media.size,
      thumbnailUrl: this.media.thumbnailUrl,
      caption: this.media.caption,
      duration: this.media.duration,
      timestamp: this.timestamp || new Date().toISOString(),
    };
  }
}

/**
 * Builder for task assignments
 */
export class TaskBuilder {
  private title: string;
  private description: string;
  private priority: TaskPayload['priority'] = 'medium';
  private botId: string;
  private dueDate?: string;
  private userId?: string;

  constructor(botId: string, title: string, description: string) {
    this.botId = botId;
    this.title = title;
    this.description = description;
  }

  setPriority(priority: TaskPayload['priority']): this {
    this.priority = priority;
    return this;
  }

  setDueDate(date: string): this {
    this.dueDate = date;
    return this;
  }

  setFrom(userId: string): this {
    this.userId = userId;
    return this;
  }

  build(): Task {
    return {
      id: uuidv4(),
      title: this.title,
      description: this.description,
      priority: this.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dueDate: this.dueDate,
    };
  }
}

/**
 * Quick factory methods
 */
export function createTextMessage(to: string, text: string): TextMessageBuilder {
  return new TextMessageBuilder(to, text);
}

export function createMediaMessage(to: string, media: MediaPayload): MediaMessageBuilder {
  return new MediaMessageBuilder(to, media);
}

export function createTask(botId: string, title: string, description: string): TaskBuilder {
  return new TaskBuilder(botId, title, description);
}

/**
 * Parse incoming message to extract relevant parts
 */
export function parseMessage(message: Record<string, unknown>): {
  type: string;
  text?: string;
  media?: MediaPayload;
  from: string;
  to: string;
} {
  return {
    type: message.type as string,
    text: (message as { text?: string }).text,
    media: (message as { media?: MediaPayload }).media,
    from: message.from as string,
    to: message.to as string,
  };
}