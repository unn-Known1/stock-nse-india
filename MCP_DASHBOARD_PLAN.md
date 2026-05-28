# MCP Dashboard Integration Plan

**Goal:** Add an "MCP/AI" tab to the browser dashboard that lets users query NSE data via natural language, manage AI sessions, and configure model parameters — all through the existing REST API.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser Dashboard (dashboard/app.js + index.html)       │
│                                                          │
│  ┌─ Market ─┬─ Stock ─┬─ Indices ─┬─ Options ─┬─ Charts ─┬─ MCP/AI ─┐
│  │          │         │           │          │         │            │
│  │          │         │           │          │         │  Query     │
│  │          │         │           │          │         │  Session   │
│  │          │         │           │          │         │  Config    │
│  │          │         │           │          │         │  History   │
│  └──────────┴─────────┴───────────┴──────────┴─────────┴────────────┘
│                                                          │
└──────────────────────────────────────────────────────┬───┘
                                                       │
                    fetch() → /api/mcp/*               │
                                                       ▼
┌──────────────────────────────────────────────────────────┐
│  Express Server (src/routes.ts)                          │
│                                                          │
│  ┌──────────────┐   ┌───────────────┐   ┌────────────┐  │
│  │ MCP Query     │   │ Session Mgmt  │   │ Context     │  │
│  │ POST /query   │   │ GET /session  │   │ Stats/Summ  │  │
│  │ GET /tools    │   │ GET /history  │   │ Config      │  │
│  └──────┬───────┘   │ PUT /prefs     │   └────────────┘  │
│         │           │ DELETE /clear  │                    │
│         │           │ GET /export    │                    │
│         ▼           └───────────────┘                     │
│  ┌────────────────┐                                       │
│  │ MCPClient      │  → OpenAI API (costs $ per call)      │
│  │ + MemoryManager│  → NseIndia API                       │
│  └────────────────┘                                       │
└──────────────────────────────────────────────────────────┘
```

---

## Backend: Ready (No Changes Needed)

All 17 MCP REST endpoints already exist under `/api/mcp/`:

| Category | Endpoints |
|----------|-----------|
| **Query** | `POST /api/mcp/query`, `GET /api/mcp/tools`, `GET /api/mcp/functions`, `GET /api/mcp/test` |
| **Session** | `GET /api/mcp/session/:id`, `GET /api/mcp/session/:id/history`, `PUT /api/mcp/session/:id/preferences`, `DELETE /api/mcp/session/:id/clear`, `GET /api/mcp/session/:id/export`, `POST /api/mcp/cleanup` |
| **Context** | `GET /api/mcp/session/:id/context-stats`, `GET /api/mcp/session/:id/context-window`, `PUT /api/mcp/session/:id/context-window`, `POST /api/mcp/session/:id/summarize` |
| **Summarization** | `GET /api/mcp/session/:id/summarization/last`, `GET /api/mcp/session/:id/summarization/history`, `GET /api/mcp/session/:id/summarization/summary`, `GET /api/mcp/session/:id/openai-messages` |

**⚠️ Critical prerequisite:** `OPENAI_API_KEY` must be set in `.env`. Without it, all AI routes return 500. The dashboard MUST detect this on load and show a clear message rather than failing silently.

**⚠️ Cost awareness:** Every call to `/api/mcp/query` and `/api/mcp/test` invokes the OpenAI API, which costs money. The `/api/mcp/test` endpoint is particularly dangerous if used as a health-check probe.

---

## Frontend: New "MCP/AI" Tab

### Tab Sections

#### 1. Query Panel

```
┌─────────────────────────────────────────────────────────┐
│  MCP / AI Query                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │ "Compare TCS and Infosys financials..."              ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [Model: gpt-4o-mini ▼]  [Temp: 0.7 ───●──]  [⏎ Send]  │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Response from AI (rendered)                        ││
│  │                                                     ││
│  │  TCS vs Infosys Comparison                          ││
│  │                                                     ││
│  │  | Metric    | TCS     | Infosys |                  ││
│  │  |-----------|---------|---------|                  ││
│  │  | Price     | 3,890   | 1,450   |                  ││
│  │                                                     ││
│  │  ---                                                ││
│  │  Tools used: get_equity_details (2 calls)           ││
│  │  Iterations: 2  |  Tokens: 1,230  |  2.3s          ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  [📋 Copy] [🔄 Regenerate] [📥 Export JSON]              │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Textarea for natural language input (Enter to send, Shift+Enter for newline)
- **After sending:** Query text persists in the textarea (does not clear) so users can tweak and re-send. A small "Cleared" indicator appears if the user manually clears it.
- **Disabled state:** If `OPENAI_API_KEY` is not detected, show a warning banner and disable Send with tooltip: "Set OPENAI_API_KEY in .env to enable AI queries"
- Model selector dropdown: `gpt-4o-mini` (default, cheapest), `gpt-4o`, `gpt-4-turbo`, `gpt-3.5-turbo`
- Temperature slider: 0.0–1.0 (capped — values above 1.0 produce near-random output for financial queries). Show a subtle warning "High temperature reduces reliability" when slider is above 0.8.
- **Rate limiting:** Disable Send button while a query is in flight. Add 500ms debounce to prevent double-clicks.
- **Timeout:** Show a "Still working..." indicator after 15s. No abort yet (backend doesn't support it).
- Response area with max-height and scroll. Renders markdown using a lightweight CDN library (marked.js + DOMPurify). **⚠️ XSS safety:** marked.js v5 removed built-in sanitization. Always pair with DOMPurify: `DOMPurify.sanitize(marked.parse(text))`. Without this, AI-generated responses containing `<script>` tags or `onclick` handlers would execute in the dashboard context.
- Metadata footer: tools used (with count), iteration count, estimated token usage, response time
- **Copy button:** Copies response text to clipboard
- **Regenerate button:** Resends the same query within the **same session context** (so conversation history is preserved and the model sees previous exchanges). This gives a different response due to the model's non-determinism while still benefiting from accumulated context. For a truly fresh attempt, the user should clear the session first.
- **Export JSON:** Full response object including metadata, iteration_details, tool_parameters
- **Keyboard shortcuts:** Ctrl+Enter or Cmd+Enter to send. Escape to close fullscreen response view (if implemented).

**API error mapping:**

| HTTP Status | Backend Response | Frontend Display |
|-------------|-----------------|------------------|
| 500 | "OpenAI API key not configured" | Warning banner: "OPENAI_API_KEY not set. Add it to .env and restart the server." + link to docs |
| 500 | "OpenAI API key is invalid" | Error: "API key is invalid. Check your OPENAI_API_KEY value." |
| 500 | "MCP Client Error: ..." | Error with the specific message from the server |
| 429 (future) | Rate limited | Warning: "Too many requests. Please wait a moment." |
| Network error | Fetch failed | Error: "Cannot reach server. Is the API running?" |
| 400 | "Query is required" | This shouldn't happen — validation issue |
| Timeout (>60s) | No response | Error: "Query timed out. Try a simpler question or check OpenAI status." |

#### 2. Session Panel

```
┌─────────────────────────────────────────────────────────┐
│  Session: sess_abc123                                   │
│                                                         │
│  Messages: 12  |  Tokens: 4,230/8,000  |  Context: 53%  │
│  [██████████████████████████░░░░░░░░░░░░░░░]            │
│  Color: ██████████████████████████░░░░░░ <60% green     │
│         ██████████████████████████████░░ 60-80% yellow  │
│         █████████████████████████████████ >80% red      │
│                                                         │
│  Status: ● Active  |  Expires: in 28m  |  TTL: 30m     │
│                                                         │
│  [📜 History] [🗑 Clear] [📤 Export] [📋 Summarize]     │
│                                                         │
│  Session ID (click to copy): sess_abc123  [📋]          │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Auto-generated session ID on first query. Stored in `localStorage['mcp_session_id']`.
- **Session validation on restore:** On page load, the stored `mcp_session_id` may reference an expired session (30 min TTL). Before treating it as active, call `GET /api/mcp/session/:id` (a cheap no-AI call). If it returns 404 → discard the stale ID, generate a new one, and show a brief "New session started (previous session expired)" notice. If it returns 200 → restore as active.
- Context stats bar fetched from `GET /api/mcp/session/:id/context-stats` while MCP tab is active. **Polling must stop** when:
  - The user switches to a different dashboard tab (use existing tab-switch hook in app.js to clear the interval)
  - The browser tab becomes hidden (`document.visibilitychange` → clear interval, resume on visible)
  - This prevents wasted requests when nobody is looking at the stats.
- Color coding: <60% green, 60-80% yellow, >80% red (triggers summarization soon).
- **Session expiry awareness:** Backend auto-expires sessions after 30 min. Show TTL countdown. If session expired (API returns 404), auto-create a new one and notify user.
- **Multiple sessions:** Dropdown to switch between recent sessions (stored in localStorage, max 5 recent). Each entry in the dropdown is **validated on open** — a lightweight `GET /api/mcp/session/:id` call marks stale sessions as "Expired" with a visual badge rather than letting the user select one and hit a 404.
- **History button:** Opens a modal/panel showing past Q&A pairs (fetched from `/api/mcp/session/:id/history`).
- **Clear button:** Confirmation dialog → `DELETE /api/mcp/session/:id/clear` → reset UI.
- **Export button:** Downloads full session data from `/api/mcp/session/:id/export` as JSON.
- **Summarize button:** `POST /api/mcp/session/:id/summarize` → shows summarization result.

#### 3. Configuration Panel

```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ MCP Configuration                                   │
│                                                         │
│  OpenAI API Key:  ● Configured (server-side)            │
│                   or                                    │
│                   ○ Not configured — see .env docs      │
│                                                         │
│  API Status:      [Test Connection]  (last: ok/error)   │
│                                                         │
│  ⚠ Cost warning: Each query calls OpenAI API and costs  │
│  money. The "Test Connection" button also costs ~$0.01. │
│                                                         │
│  Context Window:                                        │
│    Max Tokens:      [8000       ────────────●──]         │
│    Reserved Tokens: [2000       ────────●──────]         │
│    Summarization Threshold: [0.60 ●────────────]         │
│                                                         │
│  Memory:          [✅ Enabled]                           │
│  Auto-Summarize:  [✅ Enabled]                          │
│  Debug Logging:   [☐ Disabled]                          │
│                                                         │
│  [Save Config]  [Reset to Defaults]                      │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- **API key status indicator:** On tab load, call `GET /api/mcp/tools`. If it returns tools list → key is configured. If it errors → key is missing. Never expose the key value in the browser.
- **Test Connection button:** Calls `GET /api/mcp/test`. Show a cost warning tooltip on hover: "This calls OpenAI API (~$0.01)". Show last test result (timestamp + ok/error).
- Context window config sliders fetched from `GET /api/mcp/session/:id/context-window` and saved via `PUT`.
- Toggle switches commit instantly via API calls.
- **Save Config** button batch-updates context window + toggles.
- **Reset to Defaults** reverts to: maxTokens=8000, reservedTokens=2000, summarizationThreshold=0.6, minMessagesToSummarize=6, summaryCompressionRatio=0.3, memory=enabled, auto-summarize=enabled, debug=disabled.
- **Note:** API key must stay server-side. No in-browser key entry for security.
- **Debug Logging toggle** controls the `MCP_DEBUG_LOGGING` env var at runtime via the MCP client's `setDebugLogging()` method. However, if the server is restarted, the env var default applies. The UI shows a small note: "Resets to env var default on server restart."

#### 4. Tools Reference Panel

```
┌─────────────────────────────────────────────────────────┐
│  📚 Available MCP Tools (32)                      [🔄]  │
│                                                         │
│  [Search tools by name or description...]                │
│                                                         │
│  ┌───────────────┬────────────────────────┬──────────┐  │
│  │ Tool           │ Description            │ Params   │  │
│  ├───────────────┼────────────────────────┼──────────┤  │
│  │ get_all_stock  │ List all NSE equity    │ none     │  │
│  │ _symbols       │ symbols                │          │  │
│  │ get_equity_    │ Get equity details     │ symbol   │  │
│  │ details        │                        │          │  │
│  │ ...            │                        │          │  │
│  └───────────────┴────────────────────────┴──────────┘  │
│                                                         │
│  Page 1 of 3  [← Prev] [Next →]    Show 50 per page    │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Fetches from `GET /api/mcp/tools` (cached 1h, same TTL pattern as symbol list)
- Client-side search/filter by tool name or description (instant, no debounce needed with 32 items)
- Paginated table: 50 rows per page (small dataset, single page may suffice)
- Refresh button invalidates cache and re-fetches
- Same table patterns as other tabs (header, pagination controls, search input)

#### 5. Query History Panel (New — not in original plan)

```
┌─────────────────────────────────────────────────────────┐
│  📜 Query History (session: sess_abc123)          [🔄]  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Q: What is TCS current price?                      │ │
│  │ A: TCS is trading at ₹3,890...                     │ │
│  │                                   2m ago  [Copy]   │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Q: Compare with Infosys                            │ │
│  │ A: Infosys is at ₹1,450...                         │ │
│  │                                   5m ago  [Copy]   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  [Load More]  Showing 2 of 12 messages                  │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Toggle-able panel (collapsed by default) within the session section
- Fetches from `GET /api/mcp/session/:id/history?maxMessages=50`
- Shows last 10 Q&A pairs with timestamps
- Each entry has a copy button for the response
- "Load More" pagination
- Clicking a past question re-populates the query input (but doesn't auto-send)

---

## Cross-Tab Integration

| Source Tab | Integration Point | Implementation |
|------------|------------------|----------------|
| **Stock Lookup** | "Ask AI about [symbol]" button | Pre-fills query: "Analyze {symbol} — give me price, fundamentals, and technical outlook" and switches to MCP tab |
| **Technical** | "Ask AI" button next to indicators | Pre-fills query: "Interpret these technical indicators for {symbol}: {paste latest values}" and switches tab |
| **Market Overview** | "Ask AI" button | Pre-fills query: "Summarize current market conditions based on this data: {paste market status}" |

These are implemented in Phase 4 (not deferred to Phase 5) because the Stock and Technical tabs are where users get the most value from AI assistance.

---

## Responsive Layout

| Viewport | Query Panel | Session Panel | Config Panel | Tools Panel |
|----------|-------------|---------------|--------------|-------------|
| Desktop (>1024px) | Full width, side-by-side with session | Right column or below query | Full width sliders | Full width table |
| Tablet (768-1024px) | Full width | Below query, horizontal stats bar | Stacked layout | Scrollable table |
| Mobile (<768px) | Full width, smaller textarea | Collapsible section | Collapsible sections | Horizontal scroll table |

Key mobile adaptations:
- Textarea reduces to 3 visible lines (expand on focus)
- Temperature/model are dropdown-only (no sliders on mobile)
- Session panel becomes a collapsible card
- Config toggles use native checkbox styling for tap targets

---

## Markdown Rendering Strategy

Use a lightweight CDN library rather than hand-rolling markdown parsing:

```html
<script src="https://cdn.jsdelivr.net/npm/marked@5/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
```

Then in JS:
```javascript
function renderMarkdown(text) {
  const rawHtml = marked.parse(text, { breaks: true, gfm: true })
  return DOMPurify.sanitize(rawHtml)
}
```

**Why marked.js over hand-rolled:**
- Handles edge cases: nested formatting, escaped characters, malformed tables
- Table support (critical for financial data responses)
- Code block syntax highlighting (future enhancement)

**⚠️ XSS is a real risk:** AI-generated responses may contain HTML. marked.js v5 removed built-in sanitization. Without DOMPurify, a response containing `<img src=x onerror=alert(1)>` or `<script>stealCookies()</script>` would execute in the dashboard origin. DOMPurify strips dangerous tags/attributes while preserving safe formatting.

**Fallback:** If CDN is unreachable, fall back to a simple `<pre>` tag showing raw text (no markdown rendering, but safe).

---

## localStorage Strategy

| Key | Value | Purpose |
|-----|-------|---------|
| `mcp_session_id` | string | Current session ID, restored on reload |
| `mcp_recent_sessions` | JSON array (max 5) | Session browser dropdown |
| `mcp_model` | string | Persisted model choice |
| `mcp_temperature` | number | Persisted temperature setting |
| `mcp_last_queries` | JSON array (max 20) | Quick re-send from history panel |

**Session restoration flow (prevents stale session bugs):**
```
Page loads → read mcp_session_id from localStorage
  → GET /api/mcp/session/{id} (cheap, no AI call)
    → 200 OK → restore session, start polling stats
    → 404 → discard stale ID, generate new session, show notice
```

**Never cache sensitive data** (API keys, full conversation history) in localStorage — only session IDs and preferences.

---

## Query Rate Limiting & Cost Awareness

```
┌─────────────────────────────────────────────────────┐
│  ⚠ Each query calls OpenAI API and costs money.     │
│  Estimated cost: $0.01–$0.10 per query depending    │
│  on model and complexity.                           │
│                                                     │
│  [✓] I understand                                   │
└─────────────────────────────────────────────────────┘
```

**Implementation:**
- Show a one-time cost acknowledgment banner the first time a user opens the MCP tab (dismissed with localStorage flag).
- Disable Send button during query processing to prevent double-submits.
- Rate limit: max 1 query in flight at a time (enforced by button state).
- Show estimated token usage from response metadata.
- The `/api/mcp/test` endpoint also costs money — show a warning before calling it. Consider replacing with a lightweight `GET /api/mcp/tools` check which is free (no OpenAI call).

---

## Implementation Order

### Phase 1: Scaffold + API Key Detection (Day 1)

| Task | Files | Detail |
|------|-------|--------|
| Add "MCP/AI" tab button + content div | `index.html` | New `<button data-tab="mcp">` in tab bar, new `<div id="mcp" class="tab-content">` |
| Add tab CSS | `style.css` | Matching styles for existing tabs + new MCP-specific classes (.mcp-query, .mcp-response, .session-bar, .config-slider) |
| API key detection on load | `app.js` | Warmup: call `GET /api/mcp/tools` → set `mcpConfigured = true/false`. Show banner if not configured. |
| Basic query UI (disabled if no key) | `app.js`, `index.html` | Textarea, model selector, temp slider, send button. Disabled state with tooltip if no API key. |
| Markdown libraries loaded | `index.html` | Add marked.js + DOMPurify CDN script tags |

**Checkpoint:** Tab renders. If API key missing, shows warning and disables Send. If key present, can type a query.

### Phase 2: Query Flow + Cost Guard (Day 2)

| Task | Files | Detail |
|------|-------|--------|
| `POST /api/mcp/query` integration | `app.js` | Send query + sessionId + model + temperature. Loading state with spinner. |
| Rate limiting | `app.js` | Disable Send while in-flight. Debounce double-clicks. |
| Response rendering | `app.js` | Call `marked.parse()` on response text. Show metadata footer. |
| Error mapping | `app.js` | Map HTTP status + error message to user-friendly display. |
| Copy + Regenerate + Export buttons | `app.js` | Copy to clipboard. Regenerate calls same query again. Export saves full JSON. |
| Cost acknowledgment banner | `app.js` | One-time first-use banner, stored in localStorage. |
| Timeout indicator | `app.js` | "Still working..." after 15s if no response yet. |

**Checkpoint:** Send query → see rendered response → copy → regenerate → export. Cost banner shown once.

### Phase 3: Session Management + History (Day 3)

| Task | Files | Detail |
|------|-------|--------|
| Session auto-create + localStorage | `app.js` | Generate sessionId on first query, persist to localStorage. |
| **Session validation on restore** | `app.js` | On load, `GET /api/mcp/session/:id` to check expiry before restoring. Discard stale IDs with user notice. |
| Context stats polling + pause | `app.js` | Fetch `/api/mcp/session/:id/context-stats` every 10s. Stop on tab switch (`data-tab` click handler) and `document.visibilitychange`. Resume when MCP tab becomes active + visible. |
| Session expiry detection | `app.js` | If 404 on session endpoints → auto-create new session, notify user. |
| Session actions | `app.js` | History modal, Clear with confirm dialog, Export, Force Summarize. |
| Multiple recent sessions | `app.js` | Dropdown with last 5 sessions from localStorage. Validate each on open with `GET /api/mcp/session/:id` — mark expired entries with visual badge. |
| Query history panel | `app.js` | Toggle-able list of past Q&A with timestamps, copy buttons. |
| Session expire countdown | `app.js` | Show remaining TTL (30 min default). |

**Checkpoint:** Reload page → session validated → expired sessions discarded with notice → context stats polled/paused correctly → clear session → new session created → history visible.

### Phase 4: Configuration (Day 4)

| Task | Files | Detail |
|------|-------|--------|
| Config panel layout | `index.html`, `style.css` | Sliders, toggles, save/reset buttons. |
| Context window config | `app.js` | GET/PUT `/api/mcp/session/:id/context-window`. Sliders update on input, save on button click. |
| Memory/summarize/debug toggles | `app.js` | Instant commit via PUT. Debug logging toggle shows note: "Resets to env var default on server restart." |
| Test Connection button | `app.js` | Call `GET /api/mcp/test`. Show cost warning on hover. Show result + timestamp. |
| Save + Reset defaults | `app.js` | Batch update all config at once. Reset sends hardcoded defaults. |
| Cross-tab integration buttons | `app.js`, `index.html` | "Ask AI" buttons on Stock, Technical, Market tabs. Pre-fill query + switch tab. |
| Dark mode CSS | `style.css` | MCP-specific elements: response area, sliders, session bar, config panels. |

**Checkpoint:** Adjust sliders → Save → see updated values → Test Connection → Reset → Dark mode OK.

### Phase 5: Tools Reference + Polish (Day 5)

| Task | Files | Detail |
|------|-------|--------|
| Tools table | `app.js`, `index.html` | Fetch from `GET /api/mcp/tools`. Paginated, searchable, filtered. |
| Tools caching | `app.js` | Cache tools list for 1h using existing TTL cache pattern. Refresh button. |
| Query history panel | `app.js` | Collapsible, loads on demand. Shows last 50 messages. |
| Mobile responsive | `style.css` | Breakpoints: <768px, <1024px. Collapsible sections, tap-friendly targets. |
| Accessibility | `index.html`, `app.js` | ARIA labels on tab button, role="log" on response area, keyboard nav for history. |
| Final testing pass | all | Test all states: no key, key present, expired session, error responses, mobile viewport. |

**Checkpoint:** Tools table renders → search works → mobile layout OK → cross-tab buttons work → accessibility passes.

---

## Reusable Dashboard Patterns

The MCP tab should reuse existing patterns from `app.js`:

| Pattern | Location in app.js | Reuse for MCP |
|---------|-------------------|---------------|
| `showLoading()` / `showError()` | Top-level helpers | Query loading / error states |
| `apiFetch()` | Generic fetch with error handling | All MCP API calls |
| `exportJSON()` | Export section | Export query responses |
| Tab system (`data-tab`, `active` class) | Tab initialization | MCP tab lifecycle |
| Port auto-detection | Startup probe | MCP endpoints on same port |
| Caching with TTL | Cache map | Tools list (1h cache) |
| Pagination | `renderPaginated()` | Tools table |
| CSV export with BOM | Export section | Optional: export response tables as CSV |
| `formatCell()` / `flattenRow()` | Table helpers | Render tool parameter schemas in tools table |

---

## Backend Gaps Affecting the Dashboard

These known backend issues impact the MCP dashboard and should be fixed before or during implementation:

| Issue | Impact on Dashboard | Recommended Fix |
|-------|--------------------|-----------------|
| `/api/mcp/test` costs ~$0.01 per call | Cannot use as auto health-check. Test button must warn user. | Create a lightweight `/api/mcp/status` endpoint that only checks if OPENAI_API_KEY is set (no OpenAI call) |
| No streaming support | Users wait 10-30s with no intermediate feedback. "Still working..." is a poor substitute. | Add SSE streaming to `/api/mcp/query` |
| Sessions expire silently (30 min TTL) | User sees "session not found" errors without explanation | Return structured error with `{ code: 'SESSION_EXPIRED', message: '...' }` so dashboard can auto-create |
| Token counting is rough (char/4) | Dashboard shows inaccurate token counts | Fix backend to use tiktoken |
| No rate limiting on backend | Users could accidentally send many expensive queries | Add server-side rate limiting |
| Missing `OPENAI_API_KEY` in `.env.example` | New users won't know they need it | Already fixed in `.env.example` |

---

## Testing Strategy

Without backend MCP tests, testing the dashboard tab requires:

| Test Approach | What It Covers | How |
|---------------|----------------|-----|
| **Mocked API responses** | All UI states (loading, success, error, empty) | Create a test mode in app.js that intercepts `/api/mcp/*` calls with realistic mock JSON. Toggle with `localStorage['mcp_test_mode'] = true`. |
| **Error state coverage** | Missing API key, rate limit, timeout, invalid session, network failure | Mock each error response and verify correct banner/message renders. |
| **Cost awareness** | Cost banner shows once, Send disabled while in-flight | Verify localStorage flag, button state changes. |
| **localStorage persistence** | Session ID, recent sessions, preferences survive reload | Mock localStorage, verify save/restore cycle. |
| **Responsive layout** | Mobile, tablet, desktop breakpoints | Manual: resize browser and verify layouts. |
| **Cross-tab integration** | "Ask AI" buttons pre-fill correctly | Manual: click from Stock tab → verify MCP tab opens with pre-filled query. |

**Mock data file:** Create `dashboard/test-data/mcp-mock-responses.json` with sample query results, tool lists, session stats, and error responses. The test mode loads these instead of calling the real API.

---

## Excluded from Scope

| Feature | Reason |
|---------|--------|
| In-browser API key entry | Security: key must stay server-side. The dashboard never sees the key. |
| Real-time streaming (SSE) | Backend doesn't support streaming. Listed as backend gap to fix. |
| Chart/visualization integration | MCP returns text, not structured chart data. Future enhancement. |
| Multi-model selection (Claude, Gemini, etc.) | Backend only supports OpenAI. Would require new backend provider abstraction. |
| MCP Server config (mcp-config.json) | That config is for AI IDE integration (Cursor, Claude Desktop), not the browser dashboard. |
| Voice input | Out of scope for a data dashboard. |
| Conversation branching / edit history | Too complex for Phase 1. Standard linear chat is sufficient. |
