# Project Review - 2026-06-03

## Overall Score: **7.5 / 10**

Strong foundation. Auth, socket validation, rate limiting well done. Gaps in error handling, testing, and production readiness.

---

## 🔒 Security (7/10)

### ✅ What's Good
- JWT auth on socket connections (`socket/handlers.ts:10-34`)
- Token validated via `supabase.auth.getUser()` — not just decoded
- `userId` override at `handlers.ts:134` — client cannot inject userId
- `XSS` sanitization via `xss` library (`messageService.ts:19`)
- CORS whitelist from env (`security.ts:5-21`)
- Rate limiter on HTTP routes (`security.ts:24-28`)
- Socket connection limits per user (`handlers.ts:40-52`)
- Env schema validation (`env.ts:4-18`)
- `trust proxy` set correctly (`index.ts:25`)
- SWAGGER password from env — not hardcoded

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| S1 | **HIGH** | `redisClient.ts:35` | `rejectUnauthorized: false` — MITM attack possible | Set to `true` in production, or use `REDIS_TLS_REJECT_UNAUTHORIZED` env flag |
| S2 | **MEDIUM** | `App.tsx:80-84` | `localStorage` keys not namespaced — potential collision with other apps on same origin | Prefix all keys: `chat:last_active_${userId}`, `chat-theme` |
| S3 | **MEDIUM** | `socket/handlers.ts:153-157` | `invitation_sent` — no server-side validation that sender has right to invite | Add DB check for `room_members` membership before emitting |
| S4 | **LOW** | `security.ts:8` | CORS origin check uses `indexOf` — race condition possible with multiple origins | Use `allowedOrigins.includes(origin)` instead |
| S5 | **LOW** | `env.ts:17` | `NODE_ENV` not validated at startup — defaults to `development` silently | Add explicit check: `if (!['development','production','test'].includes(process.env.NODE_ENV))` |

### 🚨 Security Gaps

1. **No input size limit on message content** — `socketValidators.ts:11` has `max(1000)` but `xss` library might still be bypassed with malformed input
2. **No SQL injection prevention layer** — relying entirely on Supabase SDK. Consider adding query parameterization audit.
3. **Socket `joinRoom` has no room existence check** — just membership check (`handlers.ts:99-110`). User can join non-existent room.
4. **No CSRF protection** on non-Socket.IO HTTP endpoints
5. **Rate limit bypass possible** — `redis.rateLimitMsg` keyed by `socket.id` not `userId`. Attacker can spin new socket connections to bypass.

---

## ⚙️ Functionality (8/10)

### ✅ What's Good
- Clean separation: Controller → Service → DB layer
- Zod schemas as single source of truth for validation
- Socket events properly namespaced
- Presence system with heartbeat + visibility API
- Message read status sync across devices
- Typing indicators working
- Realtime postgres_changes for invitations, room memberships
- Dark mode support
- Session inactivity timeout (24h)

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| F1 | **HIGH** | `useSocketAndPresence.ts:109-296` | 500ms artificial delay before setting up realtime subscriptions | Remove delay or make it configurable via env |
| F2 | **MEDIUM** | `socket/handlers.ts:170` | `io.in(userId).fetchSockets()` called on every disconnect — O(n) scalability issue | Add local tracking or use Redis to count active connections |
| F3 | **MEDIUM** | `messageService.ts:40-71` | User cache miss fetches DB then sets Redis. No TTL refresh on cache hit. | Refresh TTL on every cache hit |
| F4 | **MEDIUM** | `App.tsx:217-233` | Session activity tracking via `setInterval` runs even when tab not visible | Add visibility check inside interval callback |
| F5 | **LOW** | `ChatWindow.tsx` (unstaged change) | Line ending changed to CRLF — may cause git noise | Normalize line endings |

### 🚨 Functional Gaps

1. **No message edit/delete support** — only INSERT postgres_changes listener, no UPDATE/DELETE
2. **No file upload validation** — only URL and extension check in Zod. No server-side file hash verification.
3. **No pagination** on message fetch — loads all messages at once
4. **`mark_read` broadcasts to entire room** including sender — should only notify others
5. **No reconnection UI** — socket disconnect shows generic console log only

---

## ⚡ Performance (7/10)

### ✅ What's Good
- Redis adapter for horizontal scaling
- Connection count limits
- Lua scripts for atomic operations
- Message rate limiting via Redis
- User data cached in Redis (1h TTL)
- Presence heartbeat every 10s — reasonable

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| P1 | **HIGH** | `handlers.ts:56-74` | Username resolve on every connection hits DB if not cached | Pre-fetch and cache during auth, pass via socket handshake |
| P2 | **MEDIUM** | `useSocketAndPresence.ts:224-267` | `presenceState()` processed on every sync/join/leave — full object scan | Filter by `user_id` before processing |
| P3 | **MEDIUM** | `useSocketAndPresence.ts:354-360` | On room list change, iterates all rooms + emits joinRoom per room — burst of emits | Batch socket.emit or use roomsets |
| P4 | **LOW** | `messageService.ts:79-95` | `markMessagesAsRead` does DB UPDATE without index hint | Add composite index on `(room_id, user_id, status)` if not exists |

### 🚨 Performance Gaps

1. **No message pagination** — large chat histories will be slow
2. **Redis connection not pooled** — single `redis` instance shared, should use `redis-mock` or connection pool for high load
3. **No query result caching** for room list, friend list — every tab open hits Supabase

---

## 🏗️ Code Quality (7/10)

### ✅ What's Good
- TypeScript throughout backend
- Zod schema typed with `z.infer<>` — no manual type duplication
- Async/await consistently used
- Error boundaries via try/catch with specific error types
- Lua scripts for atomic Redis ops

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| C1 | **MEDIUM** | `socket/handlers.ts:123` | `data: any` — loses type safety | Use `z.object()` parse with error handling |
| C2 | **MEDIUM** | `useSocketAndPresence.ts:51-84` | `any` used for messageWithUser — should be typed | Create `WebSocketMessage` interface |
| C3 | **MEDIUM** | `redisClient.ts:18` | `redisOptions: any` — no type checking on Redis config | Define `RedisOptions` interface |
| C4 | **LOW** | `App.tsx:75-99` | `clearInvalidSession` duplicated in multiple places | Extract to `auth.ts` utility |
| C5 | **LOW** | `index.ts:75-80` | `console.log` used instead of logger — inconsistent | Replace with `logger.info` |

### 🚨 Code Quality Gaps

1. **No error boundary component** in React frontend
2. **No loading states** for friend list, room list fetch
3. **Magic strings everywhere** — event names (`newMessage`, `typing`, `joinRoom`) not centralized
4. **No API response wrapper** — each endpoint returns raw Supabase response

---

## 🧪 Testing (5/10)

### What's Present
- Unit tests for `messageController`, `messageService`, `cronJobs`, `socketValidators`
- Security and performance test files
- Vitest + Playwright setup

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| T1 | **HIGH** | `tests/` | No integration tests for socket events | Add socket.io client integration tests |
| T2 | **HIGH** | `tests/` | No test for Redis failure scenarios | Add tests for Redis down/misconfigured |
| T3 | **MEDIUM** | `tests/unit/messageService.test.ts` | Likely mocks Supabase directly instead of using real test DB | Use Supabase local development or test containers |
| T4 | **MEDIUM** | `frontend/src/test/` | Tests exist but no CI run for frontend tests | Add `npm test` to CI pipeline |

### 🚨 Testing Gaps

1. **No E2E tests for auth flow** — only `auth-flow.unauth.spec.ts` exists
2. **No test coverage for handlers.ts connection limit logic**
3. **No load testing** — `performance.test.ts` likely unit-level only

---

## 🌐 Production Readiness (6/10)

### ⚠️ Issues Found

| # | Severity | Location | Problem | Fix |
|---|----------|----------|---------|-----|
| PR1 | **HIGH** | `index.ts:72-80` | `runCleanup()` called on every startup — cron not idempotent | Add flag or check if cleanup already ran today |
| PR2 | **HIGH** | `env.ts` | No `.env.example` file — onboarding gap | Add `env.example` with all vars and safe defaults |
| PR3 | **MEDIUM** | `index.ts:62-66` | Redis adapter setup has no error handling — crashes if Redis unavailable | Add try/catch with graceful degradation |
| PR4 | **MEDIUM** | `socket/handlers.ts:159-178` | Disconnect handler catches errors but still runs cleanup — orphaned connections possible | Add circuit breaker pattern |
| PR5 | **LOW** | `package.json` | No `scripts.start:prod` — `node dist/index.js` vs `ts-node` | Add proper start script |

### 🚨 Production Gaps

1. **No health check endpoint** returns database or Redis status — only returns "healthy" without checking deps
2. **No graceful shutdown** — SIGTERM handler not implemented, in-flight requests dropped
3. **No deployment Dockerfile** for containerized deployment
4. **Logs not structured** — morgan `combined` format not JSON, hard to parse in cloud log systems
5. **No metrics/monitoring** — no Prometheus metrics endpoint

---

## 📋 Priority Checklist

### Must Fix (before production)
- [x] S1: Redis TLS rejection (MITM risk)
- [x] F1: Remove 500ms delay in realtime setup
- [x] PR1: Make cleanup idempotent
- [x] PR3: Graceful Redis adapter error handling
- [x] T1: Socket integration tests _(false alarm — already covered by `security.test.ts` + `performance.test.ts`)_

### Should Fix (this sprint)
- [x] S3: `invitation_sent` authorization check
- [x] F3: Cache TTL refresh on hit
- [ ] P2: Presence state filtering _(deferred — not in this iteration)_
- [x] PR2: Add `.env.example` _(false alarm — already exists)_
- [ ] T2: Redis failure tests _(deferred — not in this iteration)_

### Nice to Have (backlog)
- [ ] Message pagination
- [ ] Error boundary components
- [ ] Structured JSON logging
- [ ] Graceful shutdown handler
- [ ] Message edit/delete support
- [x] S4: CORS `indexOf` → `includes()`
- [x] C1: Type socket payloads with Zod
- [x] C2: Type `messageWithUser` (WebSocketMessage)
- [x] C5: Replace `console.log` with `logger` in `index.ts`
- [x] F4: Visibility-aware session interval
- [x] T4: Frontend CI uses `npm test`
- [x] NEW-1: Reconnection banner on socket disconnect

---

*Review generated: 2026-06-03. Backend: Node.js/Express/Socket.IO/Supabase/Redis. Frontend: React/Vite/TypeScript.*

---

## ✅ Verification Status (post-review)

Each item from the original review was re-checked against the actual source on 2026-06-03. Status column marks the finding as **REAL** (genuine bug to fix), **FALSE** (already addressed / report is wrong), or **SKIP** (deferred to a later milestone).

### 🔒 Security

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| S1 | Redis TLS `rejectUnauthorized:false` | **REAL** | `backend/redisClient.ts:33-37` — hardcoded, no env override. MITM risk. |
| S2 | localStorage namespace | **FALSE** | `chat-theme` key is namespaced. Lines 80-84 remove 3rd-party Supabase keys, not app keys. |
| S3 | `invitation_sent` no authz | **REAL** | `backend/socket/handlers.ts:152-157` — no membership check, no rate limit. |
| S4 | CORS `indexOf` | **REAL** | `backend/config/security.ts:13` — stylistic, easy fix. |
| S5 | `NODE_ENV` not validated | **FALSE** | `backend/config/env.ts:17` already uses `z.enum([...])`. |

### ⚙️ Functionality

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| F1 | 500ms artificial delay | **REAL** | `useSocketAndPresence.ts:109` and `:288-293` — two `setTimeout(..., 500)`. |
| F2 | O(n) disconnect scan | **SKIP** | Acceptable at current scale; revisit at >1k concurrent users. |
| F3 | Cache TTL not refreshed on hit | **REAL** | `messageService.ts:50-71` — only `EX 3600` on miss. |
| F4 | Session interval ignores visibility | **REAL** | `App.tsx:223-225` — no `visibilityState` check. |
| F5 | ChatWindow.tsx CRLF | **FALSE** | File is LF. |

### 🏗️ Code Quality

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| C1 | `data: any` in handlers | **REAL** | `handlers.ts:123, 139, 143` — should use Zod. |
| C2 | `messageWithUser: any` | **REAL** | `useSocketAndPresence.ts:52`. |
| C4 | `clearInvalidSession` duplicated | **SKIP** | Out of scope for this PR. |
| C5 | `console.log` in `index.ts` | **REAL** | `index.ts:75-80` — bundled with PR1 fix. |

### 🧪 Testing

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| T1 | No socket integration tests | **FALSE** | `security.test.ts` and `performance.test.ts` already exercise live sockets. |
| T4 | CI uses `npx vitest` not `npm test` | **REAL** | Trivial: change `ci.yml:120`. |

### 🌐 Production Readiness

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| PR1 | Cleanup not awaited, no try/catch | **REAL** | `index.ts:72-80` — fire-and-forget, unhandled rejections possible. |
| PR2 | Missing `.env.example` | **FALSE** | Both `backend/.env.example` and `frontend/.env.example` exist. |
| PR3 | Redis adapter no try/catch | **REAL** | `index.ts:62-66` — adapter init failure crashes server. |
| PR5 | `start:prod` script | **FALSE** | Exists in `backend/package.json:7` (identical to `start`). |

### Additional findings (not in original review)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| NEW-1 | Reconnection UI missing | **REAL** | `frontend/src/socket.ts:59-67` only logs to console. No banner, no toast. |

### Summary

- **REAL fixes for this PR:** 12 (S1, S3, S4, F1, F3, F4, C1, C2, C5, PR1, PR3, T4, NEW-1) — corrected count: **13**.
- **FALSE / already addressed:** 6 (S2, S5, F5, T1, PR2, PR5).
- **SKIPPED:** 2 (F2, C4).

---

## 🛠️ Changes Applied (2026-06-03)

All 13 REAL items implemented in working tree. **Not yet committed** — awaiting user review.

### Backend (8 files)

| Issue | File | Change |
|-------|------|--------|
| **S1** | `backend/redisClient.ts` | `rejectUnauthorized` now reads `env.REDIS_TLS_REJECT_UNAUTHORIZED` (env-controlled, defaults to `false` for dev). |
| **S1** | `backend/config/env.ts` | Added `REDIS_TLS_REJECT_UNAUTHORIZED: z.enum(['true','false']).default('false')` to Zod schema. |
| **S1** | `backend/.env.example` | Documented new var with dev/prod guidance. |
| **S3** | `backend/validators/socketValidators.ts` | New `InvitationSchema` (requires `roomId` + `inviteeId`). |
| **S3** | `backend/socket/handlers.ts` | `invitation_sent` now Zod-parses payload and checks `room_members` membership before emitting. Reject with `socket.emit('error', ...)` if not a member. |
| **C1** | `backend/socket/handlers.ts` | `sendMessage` / `typing` / `stop_typing` / `mark_read` now `safeParse` their Zod schemas; reject with structured error on failure. |
| **F3** | `backend/services/messageService.ts` | Cache hit branch now fires `redis.expire(cacheKey, 3600)` (sliding TTL, non-blocking with warn on error). |
| **PR1 + C5** | `backend/index.ts` | `runCleanup()` wrapped in async IIFE with try/catch; `console.log` replaced with `logger.info`. Cleanup is naturally idempotent (filters by `created_at < threshold`). |
| **PR3** | `backend/index.ts` | Redis adapter setup wrapped in try/catch + `process.exit(1)` on failure. Added `pubClient.on('error', ...)` listener (only subClient had one). |
| **S4** | `backend/config/security.ts` | `allowedOrigins.indexOf(origin) !== -1` → `allowedOrigins.includes(origin)`. |

### Backend test update (1 file)

| File | Change |
|------|--------|
| `backend/tests/unit/messageService.test.ts` | Added `expire: vi.fn().mockResolvedValue(1)` to the redis mock (required by F3). |

### Frontend (5 files)

| Issue | File | Change |
|-------|------|--------|
| **F1** | `frontend/src/hooks/useSocketAndPresence.ts` | Removed both `setTimeout(..., 500)` blocks (outer wrapper at `:109` and inner presence post-subscribe at `:288`). Realtime subscriptions now fire immediately. |
| **F4** | `frontend/src/App.tsx` | Session activity interval now skips when `document.visibilityState !== 'visible'`. |
| **C2** | `frontend/src/types/index.ts` | New `WebSocketMessage` interface (extends `Message` with required `user: User`). |
| **C2** | `frontend/src/hooks/useSocketAndPresence.ts` | `handleUnifiedNewMessage` parameter now typed `WebSocketMessage` (was `any`). Removed `userData` fallback (use `user` only). |
| **NEW-1** | `frontend/src/socket.ts` | New module-level `connectionListeners` set + `onConnectionStateChange(cb)` subscription API. `connect` / `disconnect` / `connect_error` events emit `'connected' | 'disconnected' | 'connecting'`. |
| **NEW-1** | `frontend/src/components/Chat.tsx` | Subscribes to connection state; shows amber `Bağlantı koptu — yeniden bağlanılıyor…` banner (top, absolute) when disconnected > 2s. |

### CI (1 file)

| Issue | File | Change |
|-------|------|--------|
| **T4** | `.github/workflows/ci.yml` | `npx vitest run --coverage` → `npm test -- --coverage` (uses the `vitest run` script wrapper). |

### Documentation (this file)

| File | Change |
|------|--------|
| `review2.md` | Added Verification Status table + this Changes Applied log. Priority Checklist items marked done. |

### Verification (passed)

- ✅ `backend` typecheck (`npx tsc --noEmit`) — 0 errors
- ✅ `frontend` typecheck (`npx tsc --noEmit`) — 0 errors
- ✅ `frontend` ESLint — clean
- ✅ Backend tests — 44 passed / 3 skipped (Redis-dependent, expected)
- ✅ Frontend tests — 35/35 passed

### Files modified (13 total)

```
.github/workflows/ci.yml
backend/.env.example
backend/config/env.ts
backend/config/security.ts
backend/index.ts
backend/redisClient.ts
backend/services/messageService.ts
backend/socket/handlers.ts
backend/tests/unit/messageService.test.ts
backend/validators/socketValidators.ts
frontend/src/App.tsx
frontend/src/components/Chat.tsx
frontend/src/hooks/useSocketAndPresence.ts
frontend/src/socket.ts
frontend/src/types/index.ts
review2.md
```

### Proposed commit plan (not yet executed)

```
docs(review): add verification status + changes-applied log to review2.md
fix(backend): harden Redis TLS via REDIS_TLS_REJECT_UNAUTHORIZED env flag
fix(backend): add membership check to invitation_sent + new InvitationSchema
fix(backend): type-check socket payloads with Zod (sendMessage, typing, stop_typing, mark_read)
fix(backend): refresh user-cache TTL on Redis hit
fix(backend): make startup cleanup and Redis adapter error-safe
fix(backend): use .includes() in CORS origin check
fix(frontend): remove 500ms delay from realtime subscription setup
fix(frontend): skip activity tick when tab hidden
fix(frontend): type WebSocketMessage and replace messageWithUser: any
feat(frontend): add reconnecting banner on socket disconnect
ci: run frontend tests via npm test in CI workflow
test(backend): add expire to redis mock for F3 cache-hit path
```

### Out of scope (deferred)

- **F2** O(n) disconnect scan — premature
- **C4** `clearInvalidSession` dedup — not in this iteration
- **P2** Presence state filtering — deferred
- **T2** Redis failure tests — deferred
- **Message pagination, edit/delete, error boundary, structured logging, graceful shutdown** — backlog