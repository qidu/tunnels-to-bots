# Tunnels-to-Bots 🦞

A scalable, self-hosted communication platform that connects mobile/web clients to AI bots through secure tunnels. Designed for large-scale multi-user deployments.

## 🌟 Features

- **Multi-Tunnel Support**: frp, Tailscale, Tunnelto
- **Multi-User & Multi-Bot**: Each user can manage multiple bots
- **Real-Time Communication**: WebSocket-based messaging
- **OpenClaw Compatible**: Message schema compatible with OpenClaw gateway protocol
- **Cross-Platform SDKs**: JavaScript, Java (Android), Swift (iOS)
- **Self-Hosted**: Full control over your infrastructure
- **Scalable**: Designed for 10,000+ concurrent connections

## 📁 Project Structure

```
tunnels-to-bots/
├── server/                  # Node.js server (self-hosted)
├── sdk/
│   ├── javascript/          # JavaScript SDK for web
│   ├── java/                # Java SDK for Android
│   └── swift/               # Swift SDK for iOS
├── examples/                # Usage examples
└── docs/                    # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for server)
- Java 11+ (for Android SDK)
- Xcode 14+ (for iOS SDK)
- A VPS with public IP (for tunnel server)

### Setting Up the Server

```bash
cd server
npm install
npm run build
npm start
```

### Using the JavaScript SDK

```bash
cd sdk/javascript
npm install
```

```typescript
import { Tunnels2Bots } from 'tunnels-to-bots-sdk';

const client = new Tunnels2Bots({
  serverUrl: 'wss://your-server.com',
  apiKey: 'your-api-key'
});

await client.connect();

client.on('message', (msg) => {
  console.log('Received:', msg);
});

client.sendMessage({
  to: 'bot-user-id',
  text: 'Hello Bot!'
});
```

## 🔧 Tunnel Options

### frp (Self-Hosted)

Most control, requires own VPS:

```yaml
# frps.ini
[common]
bind_port = 7000
dashboard_port = 7500
token = your-secret-token

[tunnels2bots]
type = tcp
local_ip = 127.0.0.1
local_port = 3000
remote_port = 6000
```

### Tailscale (Mesh Network)

Built-in zero-trust networking:

```bash
tailscale serve --bg --https 443 --to localhost:3000
```

### Tunnelto (SaaS)

Quick setup, no VPS needed:

```bash
tunnelto --port 3000 --subdomain your-app
```

## 📚 Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Tunnel Setup Guide](docs/TUNNEL_SETUP.md)
- [SDK Usage](docs/SDK_USAGE.md)

## 🔒 Security

- JWT-based authentication
- API key management per user
- Rate limiting
- Message encryption (TLS)
- User session isolation

## 📊 Scalability

The server supports:
- Horizontal scaling via Redis pub/sub
- 10,000+ concurrent WebSocket connections
- Automatic reconnection
- Message queue for offline delivery

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License - See LICENSE file

---

Built with ❤️ for the OpenClaw community