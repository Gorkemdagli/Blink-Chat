# Socket.IO Redis-Based Rate Limiting Design

## Context

Current Socket.IO message rate limiting uses an in-memory `Map<socket.id, timestamp>` with 500ms cooldown. This is bypassable via:
- Multiple connections from same user
- Server restart clearing the Map
- Multi-instance deployments (no shared state)

Additionally, there is no per-user connection limiting — a single user can open unlimited concurrent WebSocket connections.

Goal: server-side, Redis-backed rate limiting per connection (per `socket.id`).

---

## 1. Message Rate Limiting

### Architecture

- **Library:** `ioredis` (already in use)
- **Atomicity:** Lua script for check-and-set (prevents race conditions across server instances)
- **Key pattern:** `ratelimit:msg:{socket.id}`
- **TTL:** 500ms (configurable via `SOCKET_RATE_LIMIT_MS`)

### Lua Script

```lua
local key = KEYS[1]
local now = ARGV[1]
local window = ARGV[2]

if redis.call('SET', key, now, 'NX', 'PX', window) then
  return 1
else
  return 0
end
```

- `SET ... NX PX` = set only if not exists, with milliseconds TTL
- Returns `1` = allowed (key was set)
- Returns `0` = rate limited (key already existed)

### Flow

```
incoming message →
  EVALSHA Lua script with (ratelimit:msg:{socket.id}, now, 500) →
    1 → proceed to message handler
    0 → emit 'rate_limited' event to client, drop message
```

### Error Event

```json
{ "event": "rate_limited", "data": { "retryAfter": 500 } }
```

### Implementation

- Lua script loaded once at startup via `redis.defineCommand`
- Called in handler via `redis.call('ratelimit:msg', socket.id, now, window)`
- Falls back to `EVAL` if `SCRIPT LOAD` not done (dev convenience)
- Replace existing `lastMessageTime` Map entirely

---

## 2. Per-User Connection Limiting

### Architecture

- **Key pattern:** `connections:{userId}`
- **Operation:** `INCR` on connect, `DECR` on disconnect
- **Max per user:** configurable (default 5, via `SOCKET_MAX_CONNECTIONS`)

### Connect Flow (before auth middleware)

```
socket handshake →
  INCR connections:{userId} →
    > MAX → disconnect socket with error
    <= MAX → proceed to auth middleware
```

### Disconnect Flow

```
socket disconnect (post-auth only) →
  DECR connections:{userId} →
  if result <= 0 → DEL key
```

### Edge Cases

- **Server crash:** key orphaned until TTL expiry. Use `EXPIRE` as safety net (24h TTL on the key). Stale keys may temporarily consume connection slots — acceptable tradeoff.
- **Auth failure after INCR:** connection rejected → need DECR. Handle in auth failure path.
- **Double disconnect:** `DECR` on already-0 key goes negative briefly — clamped to 0 via Lua script.

### Lua for Decrement (safe)

```lua
local key = KEYS[1]
local val = redis.call('DECR', key)
if val <= 0 then
  redis.call('DEL', key)
  return 0
end
return val
```

---

## 3. Configuration

### New Env Vars

| Variable | Default | Description |
|---|---|---|
| `SOCKET_RATE_LIMIT_MS` | `500` | Message cooldown window in ms |
| `SOCKET_MAX_CONNECTIONS` | `5` | Max concurrent connections per userId |

Added to `backend/config/env.ts`.

---

## 4. Files to Modify

| File | Change |
|---|---|
| `backend/socket/handlers.ts` | Replace Map with Lua-script Redis rate limiting; add connection counting |
| `backend/config/env.ts` | Add `SOCKET_RATE_LIMIT_MS`, `SOCKET_MAX_CONNECTIONS` |
| `backend/config/security.ts` | (optional) `SOCKET_MAX_CONNECTIONS` also applies to HTTP? No — socket only |

---

## 5. Testing

### Unit Tests
- Lua script: returns 1 on first call, 0 on second call within window
- Lua script: returns 1 after TTL expires
- Connection INCR/DECR logic at boundaries (0, 1, max, max+1)

### Integration Tests
- Rapid messages → verify `rate_limited` event received
- Open N connections (at cap) → N+1th rejected
- One connection disconnects → new connection allowed
- Server restart → rate limiting still enforced (Redis persists)

---

## 6. Removed

- `lastMessageTime` Map (`Map<string, number>`)
- `MESSAGE_COOLDOWN_MS` constant (replaced by env var)
