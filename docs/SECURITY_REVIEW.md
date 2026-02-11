# Security & Privacy Review - Tunnels-to-Bots Platform

**Date:** 2026-02-11
**Reviewer:** Clawra
**Classification:** Internal Security Audit

---

## Executive Summary

⚠️ **CRITICAL SECURITY ISSUES FOUND**

The current implementation has **severe privacy vulnerabilities** that allow users to view data from other users. This violates the core security requirement: "users CAN NOT see each other, CAN NOT retrieve messages and data of other users."

---

## Critical Issues (Must Fix)

### 1. 🚨 Dashboard API Exposes All User Data

**Severity:** CRITICAL  
**Status:** ✅ FIXED (partially)

**Problem:** The dashboard API endpoints expose ALL server data without authentication:
- `/api/stats` returns all connections, sessions, bots, tasks, and logs
- `/api/connections` exposes connection IDs and user IDs
- `/api/bots` exposes all bots with their owners

**Impact:** Any user can enumerate all other users' connections and activities.

**Current Behavior:**
```javascript
getStats() {
  return {
    connections: Array.from(connections.values()), // ALL connections!
    sessions: Array.from(sessions.values()),       // ALL sessions!
    bots: Array.from(bots.values()),               // ALL bots!
    tasks: Array.from(tasks.values()),             // ALL tasks!
    logs: serverLogs                               // Sensitive logs!
  };
}
```

**Required Behavior:** Each user should only see THEIR own data.

---

### 2. 🚨 No User-Bot Ownership Verification

**Severity:** CRITICAL  
**Status:** ❌ NOT FIXED

**Problem:** Users can subscribe to ANY bot by ID without proving ownership.

**Current Code:**
```javascript
handleSubscribe(ws, frame) {
  // No ownership check!
  ws.subscribedBots.add(frame.data.botId);
}
```

**Impact:** User A can subscribe to User B's bot and receive all messages.

---

### 3. 🚨 No Message Destination Verification

**Severity:** CRITICAL  
**Status:** ❌ NOT FIXED

**Problem:** Users can send messages to ANY bot, not just their own.

**Current Code:**
```javascript
handleMessageFrame(ws, frame) {
  // No check that 'to' bot belongs to ws.userId
  const { to, text } = frame.data;
  // ... sends message without ownership verification
}
```

---

### 4. 🚨 Weak Authentication

**Severity:** HIGH  
**Status:** ❌ NOT FIXED

**Problem:** API key format reveals user ID and has no cryptographic security.

**Current Code:**
```javascript
ws.userId = frame.data.apiKey?.split('_')[1] || 'user';
```

**Issues:**
- User ID extracted from unverified key format
- No signature verification
- Easy to forge keys: `t2b_<any_userid>`

---

## High Severity Issues

### 5. 🔒 CORS Too Permissive

**Severity:** MEDIUM  
**Status:** ⚠️ NEEDS REVIEW

**Problem:** Dashboard allows all origins:
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Fix:** Restrict to trusted origins or implement authentication first.

---

### 6. 🔒 No Rate Limiting

**Severity:** MEDIUM  
**Status:** ❌ NOT IMPLEMENTED

**Problem:** No limits on:
- WebSocket message frequency
- Connection attempts
- Task creation

**Risk:** DoS attacks, message spam.

---

### 7. 🔒 No Input Sanitization

**Severity:** MEDIUM  
**Status:** ❌ NOT IMPLEMENTED

**Problem:** User input stored and echoed without sanitization.

**Risk:** XSS in web clients, injection attacks.

---

## Security Requirements Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| User isolation (no cross-user data access) | ❌ | Critical - Not implemented |
| Bot ownership verification | ❌ | Critical - Not implemented |
| Message destination validation | ❌ | Critical - Not implemented |
| Secure authentication | ❌ | High - Weak key format |
| Dashboard authentication | ⚠️ | High - No auth on API |
| Rate limiting | ❌ | Medium - Not implemented |
| Input sanitization | ❌ | Medium - Not implemented |
| Encrypted transport (WSS) | ✅ | Using WebSocket Secure |
| Session isolation | ⚠️ | Partial - No session checks |

---

## Architecture Diagram (Current - INSECURE)

```
┌─────────────────────────────────────────────────────────────┐
│                    TUNNEL SERVER                             │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ User A       │    │ User B       │    │ User C       │   │
│  │ ──────────── │    │ ──────────── │    │ ──────────── │   │
│  │ • Connects   │    │ • Connects   │    │ • Connects   │   │
│  │ • Sees ALL   │    │ • Sees ALL   │    │ • Sees ALL   │   │
│  │   bots       │    │   bots       │    │   bots       │   │
│  │ • Accesses   │    │ • Accesses   │    │ • Accesses   │   │
│  │   ANY bot    │    │   ANY bot    │    │   ANY bot    │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │            │
│         └───────────────────┼───────────────────┘            │
│                             │                                │
│                    SHARED DATA STORE                         │
│                    (No Isolation!)                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    TUNNEL SERVER (SECURE)                   │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ User A       │    │ User B       │    │ User C       │   │
│  │ ──────────── │    │ ──────────── │    │ ──────────── │   │
│  │ • Connects   │    │ • Connects   │    │ • Connects   │   │
│  │ • Sees ONLY  │    │ • Sees ONLY  │    │ • Sees ONLY  │   │
│  │   own bots   │    │   own bots   │    │   own bots   │   │
│  │ • Sends to   │    │ • Sends to   │    │ • Sends to   │   │
│  │   own bots   │    │   own bots   │    │   own bots   │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                   │            │
│         └───────────────────┼───────────────────┘            │
│                             │                                │
│              ┌──────────────┼──────────────┐                 │
│              │              │              │                 │
│        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐         │
│        │ User A    │  │ User B    │  │ User C    │         │
│        │ Data      │  │ Data      │  │ Data      │         │
│        │ ISOLATED  │  │ ISOLATED  │  │ ISOLATED  │         │
│        └───────────┘  └───────────┘  └───────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Recommended Fixes

### Priority 1: User Isolation

1. **Add ownership verification to all operations:**
   ```javascript
   function verifyBotOwnership(userId, botId) {
     const bot = bots.get(botId);
     return bot && bot.userId === userId;
   }
   
   handleSubscribe(ws, frame) {
     const { botId } = frame.data;
     if (!verifyBotOwnership(ws.userId, botId)) {
       return this.sendError(ws, 403, 'Bot not found or access denied');
     }
     ws.subscribedBots.add(botId);
   }
   ```

2. **Filter all queries by user:**
   ```javascript
   getUserConnections(userId) {
     return Array.from(connections.values())
       .filter(ws => ws.userId === userId)
       .map(id => /* ... */);
   }
   ```

### Priority 2: Dashboard Security

1. **Require authentication for dashboard:**
   ```javascript
   function requireDashboardAuth(req, res) {
     const token = req.headers.authorization?.replace('Bearer ', '');
     if (!token || token !== process.env.DASHBOARD_SECRET) {
       res.writeHead(401);
       res.end('Unauthorized');
       return false;
     }
     return true;
   }
   ```

2. **Or restrict to localhost only:**
   ```javascript
   if (req.socket.localAddress !== req.socket.remoteAddress) {
     res.writeHead(403);
     res.end('Local access only');
     return;
   }
   ```

### Priority 3: Stronger Authentication

1. **Use proper API keys:**
   ```javascript
   function validateApiKey(apiKey) {
     // Key format: t2b_<userid>_<signature>
     const parts = apiKey.split('_');
     if (parts.length !== 3) return null;
     
     const [prefix, userId, signature] = parts;
     if (prefix !== 't2b') return null;
     
     // Verify signature against stored secret
     const expectedSig = crypto
       .createHmac('sha256', config.auth.api_secret)
       .update(userId)
       .digest('hex')
       .substring(0, 16);
     
     return signature === expectedSig ? userId : null;
   }
   ```

### Priority 4: Rate Limiting

```javascript
const rateLimit = new Map();

function checkRateLimit(userId, action, max = 10, windowMs = 60000) {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const window = rateLimit.get(key) || { count: 0, reset: now + windowMs };
  
  if (now > window.reset) {
    window.count = 1;
    window.reset = now + windowMs;
  } else {
    window.count++;
  }
  
  rateLimit.set(key, window);
  return window.count <= max;
}
```

---

## Testing Checklist

- [ ] User A cannot see User B's connections
- [ ] User A cannot see User B's bots
- [ ] User A cannot see User B's tasks
- [ ] User A cannot subscribe to User B's bot
- [ ] User A cannot send messages to User B's bot
- [ ] Dashboard requires authentication
- [ ] Invalid API keys are rejected
- [ ] Rate limits are enforced

---

## Next Steps

1. **IMMEDIATE:** Add bot ownership verification
2. **IMMEDIATE:** Secure dashboard API
3. **SHORT TERM:** Implement proper authentication
4. **SHORT TERM:** Add rate limiting
5. **LONG TERM:** Consider JWT tokens, proper session management

