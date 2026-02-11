# @openclaw/tunnel-channel

Tunnel channel plugin for OpenClaw - connects to tunnels-to-bots platform for remote bot access.

## Features

- **WebSocket Connection**: Secure bidirectional communication with tunnel gateway
- **Bot Registration**: Automatically register OpenClaw bots with tunnel service
- **Message Routing**: Forward messages between clients and bots
- **Reconnection**: Automatic reconnection on disconnect
- **Heartbeat**: Keep-alive pings to maintain connection

## Installation

```bash
npm install @openclaw/tunnel-channel
```

## Configuration

Add to your OpenClaw configuration:

```yaml
channels:
  tunnel:
    enabled: true
    serverUrl: "wss://tunnel.example.com:3000/ws"
    apiKey: "t2b_your_user_id_your_signature"
    botIds: []  # Empty = all bots, or list specific bot IDs
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `serverUrl` | Yes | WebSocket URL of tunnel gateway |
| `apiKey` | Yes | Your tunnels-to-bots API key |
| `botIds` | No | Array of bot IDs to expose (default: all bots) |
| `reconnectInterval` | No | Reconnect delay in ms (default: 5000) |
| `heartbeatInterval` | No | Heartbeat interval in ms (default: 30000) |

## Getting Your API Key

1. Register at tunnels-to-bots platform
2. Get your API key from the dashboard
3. Format: `t2b_<userId>_<signature>`

## Example: Full OpenClaw Config

```yaml
# OpenClaw Configuration
app:
  name: "My OpenClaw"
  port: 3000

channels:
  telegram:
    enabled: true
    botToken: "YOUR_TELEGRAM_TOKEN"
  
  whatsapp:
    enabled: true
  
  tunnel:
    enabled: true
    serverUrl: "wss://tunnel.example.com:3000/ws"
    apiKey: "t2b_demo_abc123def456"
    botIds:
      - "bot_assistant"
      - "bot_helper"

plugins:
  - "@openclaw/tunnel-channel"
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  OpenClaw Instance                              │
│                                                 │
│  ┌─────────────┐      ┌─────────────────────┐  │
│  │ Bots        │ ────▶│ Tunnel Plugin       │  │
│  │             │      │                     │  │
│  │ • Clawra    │      │ • Register bots     │  │
│  │ • Helper    │      │ • Route messages    │  │
│  │ • Coder     │      │ • Handle events     │  │
│  └─────────────┘      └──────────┬──────────┘  │
│                                  │             │
└──────────────────────────────────┼─────────────┘
                                   │
                                   ▼ WebSocket
┌──────────────────────────────────┼─────────────┐
│  Tunnel Gateway                  │             │
│                                 │             │
│  • Authenticate clients         │             │
│  • Isolate user data            │             │
│  • Route messages               │             │
└──────────────────────────────────┴─────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## API Key Management

### Generate API Key (Server Side)

```typescript
import { createHash } from "crypto";

function generateApiKey(userId: string, secret: string): string {
  const signature = createHash("sha256")
    .update(`${userId}:${secret}`)
    .digest("hex")
    .substring(0, 16);
  return `t2b_${userId}_${signature}`;
}
```

### Validate API Key (Server Side)

```typescript
import { createHash, timingSafeEqual } from "crypto";

function validateApiKey(apiKey: string, secret: string): string | null {
  const parts = apiKey.split("_");
  if (parts.length !== 3) return null;
  
  const [prefix, userId, signature] = parts;
  if (prefix !== "t2b") return null;
  
  const expected = createHash("sha256")
    .update(`${userId}:${secret}`)
    .digest("hex")
    .substring(0, 16);
  
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  
  return userId;
}
```

## Security

- API keys use HMAC-SHA256 signatures
- User isolation enforced at gateway level
- Timing-safe comparison prevents timing attacks
- Configured secrets should be stored securely

## License

MIT
