/**
 * OpenClaw Protocol Adapter
 * Adapts OpenClaw gateway message schema for tunnels-to-bots
 */
/**
 * Convert tunnels-to-bots message to OpenClaw format
 */
export function toOpenClawFormat(message, options) {
    const base = {
        id: message.id,
        channel: options.channel,
        source: {
            type: options.sourceType,
            authorId: message.from,
        },
        target: {
            type: 'session',
            id: options.targetSessionId || message.to,
        },
        content: {
            type: 'text',
            text: '',
        },
        timestamp: message.timestamp,
        replyTo: message.replyTo,
        metadata: message.metadata,
    };
    switch (message.type) {
        case 'text':
            base.content.type = 'text';
            base.content.text = message.text;
            break;
        case 'media':
            base.content.type = 'media';
            base.content.media = {
                type: message.mediaType,
                url: message.url,
                mimeType: message.mimeType,
                size: message.size,
                metadata: {
                    caption: message.caption,
                    duration: message.duration,
                },
            };
            break;
        case 'action':
            base.content.type = 'action';
            base.content.actions = [
                {
                    type: message.action,
                    label: message.action,
                    value: JSON.stringify(message.data),
                },
            ];
            break;
        case 'system':
            base.content.type = 'composite';
            base.content.text = message.systemType;
            break;
    }
    return base;
}
/**
 * Convert OpenClaw message to tunnels-to-bots format
 */
export function fromOpenClawFormat(message) {
    const to = message.target.id;
    const content = message.content;
    // Build base message
    const base = {
        id: message.id,
        from: message.source.authorId,
        to,
        timestamp: message.timestamp,
        replyTo: message.replyTo,
        metadata: message.metadata,
    };
    switch (content.type) {
        case 'text':
            return {
                ...base,
                type: 'text',
                text: content.text || '',
                contentType: 'plain',
            };
        case 'media':
            return {
                ...base,
                type: 'media',
                mediaType: content.media.type,
                url: content.media.url,
                mimeType: content.media.mimeType,
                size: content.media.size,
                ...(content.media.metadata?.caption && { caption: content.media.metadata.caption }),
                ...(content.media.metadata?.duration && { duration: content.media.metadata.duration }),
            };
        case 'action':
            return {
                ...base,
                type: 'action',
                action: content.actions?.[0]?.type || 'unknown',
                data: content.actions?.[0]?.value ? JSON.parse(content.actions[0].value) : {},
            };
        case 'composite':
        default:
            return {
                ...base,
                type: 'system',
                systemType: 'bot_connected', // Default for composite
            };
    }
}
/**
 * Send message to OpenClaw gateway
 */
export async function sendToOpenClaw(gatewayUrl, sessionId, message) {
    try {
        const response = await fetch(`${gatewayUrl}/sessions/${sessionId}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            },
            body: JSON.stringify(message),
        });
        if (!response.ok) {
            throw new Error(`OpenClaw gateway error: ${response.status}`);
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error('Failed to send to OpenClaw:', error);
        return null;
    }
}
/**
 * Create a new OpenClaw session
 */
export async function createOpenClawSession(gatewayUrl, options) {
    try {
        const response = await fetch(`${gatewayUrl}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            },
            body: JSON.stringify({
                kind: 'session.create',
                payload: {
                    model: options.model,
                    channel: options.channel,
                    systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.',
                },
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.status}`);
        }
        const result = await response.json();
        return result.sessionId || null;
    }
    catch (error) {
        console.error('Failed to create OpenClaw session:', error);
        return null;
    }
}
/**
 * Get OpenClaw session status
 */
export async function getOpenClawSession(gatewayUrl, sessionId) {
    try {
        const response = await fetch(`${gatewayUrl}/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            },
        });
        if (!response.ok) {
            return null;
        }
        return await response.json();
    }
    catch (error) {
        console.error('Failed to get OpenClaw session:', error);
        return null;
    }
}
/**
 * Close OpenClaw session
 */
export async function closeOpenClawSession(gatewayUrl, sessionId) {
    try {
        const response = await fetch(`${gatewayUrl}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
            },
        });
        return response.ok;
    }
    catch (error) {
        console.error('Failed to close OpenClaw session:', error);
        return false;
    }
}
//# sourceMappingURL=openclaw-adapter.js.map