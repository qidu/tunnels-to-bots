# Tunnels-to-Bots Examples

## 📱 Web Demo (Mobile-Friendly)

**Location:** `examples/web/`

A mobile-optimized web chat interface for testing the tunnels-to-bots SDK.

### Features
- 🎨 Mobile-first dark theme design
- 📱 Touch-friendly buttons and inputs
- 🤖 Bot selection carousel
- 💬 Real-time messaging
- 📋 Task creation
- ⚡ Quick action buttons

### Run
```bash
cd examples/web
npm install
node demo.js

# Open http://localhost:3000 in browser
# Or access via your phone on same network
```

### Screenshots
- Dark gradient background
- Connection status bar
- Horizontal bot selection
- Chat messages with sent/received distinction
- Quick action chips

---

## 🤖 Android Demo

**Location:** `examples/android/`

Native Android app demonstrating the Kotlin SDK.

### Features
- Kotlin WebSocket client
- RecyclerView message list
- Bot selection spinner
- Task creation form
- Connection management

### Setup
```bash
cd examples/android
# Open in Android Studio
# Or build from command line:
./gradlew assembleDebug
```

### Key Files
```
android/
├── app/src/main/
│   ├── java/com/tunnels2bots/demo/
│   │   ├── MainActivity.kt      # Main chat UI
│   │   ├── Tunnels2BotsClient.kt  # WebSocket SDK
│   │   └── MessageAdapter.kt    # Message list adapter
│   ├── res/
│   │   ├── layout/activity_main.xml
│   │   └── values/
│   └── AndroidManifest.xml
└── build.gradle
```

### Usage
1. Enter server URL (default: `ws://10.0.2.2:3000/ws`)
2. Enter API key (any string starting with `t2b_`)
3. Select a bot
4. Start chatting!

---

## 🚀 Quick Test

### Start Server
```bash
cd examples/web
node demo.js
```

### Open Web Demo
```
http://localhost:3000
```

### Connect Android Demo
```
ws://localhost:3000/ws
API key: t2b_demo
```

---

## 📦 SDK Locations

```
sdk/
├── javascript/
│   └── dist/
│       ├── client.js           # Standard client
│       └── client-compressed.js # With gzip compression
│
└── README.md                   # SDK documentation
```
