# Chat History Sentinel — Design Spec

## Context

In `ChatWindow.tsx`, the useEffect pushes `#chat` to history on mount but cleanup never removes it. When chat closes and a new room opens, the effect skips the push (hash already `#chat`), and `handleHardwareSafeBack` calls `window.history.back()` on an unpredictable state. Risk increases when chat state changes outside the header back button.

## Solution

Separate UI close from browser traversal. Use a module-level sentinel counter to track how many `#chat` pushState entries are "alive" on the history stack. Counter incremented on every room mount. Decremented only on controlled close (replaceState). Hardware/popstate back navigates within the sentinel range without closing chat.

## Architecture

**Sentinel counter** — module-level `let chatHistorySentinel = 0`:
- `sentinel++` — every mount/room-change effect run (unconditional pushState)
- `sentinel--` — only on controlled close (replaceState)
- Cleanup does NOT touch sentinel (unmount handled via popstate)

**Close helper** (`closeChatWithHistory`):
1. `replaceState(null, '', cleanUrl)` — removes `#chat`, no popstate triggered
2. `sentinel--`
3. `onBackRef.current()` — parent sets `currentRoom = null`, component unmounts

**popstate handler**:
- `sentinel > 1` → decrement, chat stays open
- `sentinel === 1` → decrement + `closeChatWithHistory()`

**handleHardwareSafeBack**: Always calls `closeChatWithHistory()` directly (bypasses `history.back()`).

## Data Flow

**Open chat**:
Effect runs → pushState + `sentinel++` (e.g., 0→1) → URL: `/path#chat`

**UI back button**:
`closeChatWithHistory()` → replaceState (URL: `/path`) + `sentinel--` (1→0) + `onBack()` → unmount

**Hardware back when sentinel > 1** (multiple rooms navigated):
`sentinel--` only → chat stays open → URL reverts to previous `#chat`

**Hardware back when sentinel === 1**:
`sentinel--` (0) + `closeChatWithHistory()` → replaceState + `onBack()` → unmount

## Edge Cases

- **Rapid open/close**: First close zeros sentinel; subsequent calls to `closeChatWithHistory` see `sentinel <= 0` and just call `onBack()` directly (harmless).
- **Spam hardware back**: Each popstate decrements sentinel; first `sentinel === 1` triggers close; subsequent popstates have no listener (unmounted).
- **Remount after close**: Sentinel is 0, effect runs, unconditional pushState + `sentinel++` → correct history entry.
- **Page refresh**: Module-level vars reset to 0; App.tsx replaceState clears hash before ChatWindow mounts; sentinel = 1 after first room open — correct.

## Files to Modify

- `frontend/src/components/ChatWindow.tsx` — add sentinel, `closeChatWithHistory`, modify effect and `handleHardwareSafeBack`
- `frontend/src/components/Chat.tsx` — no changes

## Verification

1. Open chat → URL has `#chat` ✓
2. Click UI back → chat closes, URL loses `#chat` ✓
3. Open Room A → switch to Room B → hardware back → returns to Room A (chat stays open) ✓
4. Hardware back again → chat closes ✓
5. Spam UI back 5× → no crash, chat closed ✓
6. Spam hardware back → only first `sentinel === 1` triggers close ✓
