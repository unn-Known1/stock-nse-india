# Stock NSE India — Functional Gaps Report

**Date:** 2026-05-28  
**Scope:** Only gaps that limit or restrict app functionality (wrong data, crashes, broken features, blocked deployments)

---

## Executive Summary

Of the ~270+ findings from the full audit, the following are gaps that **actually prevent the app from working correctly** — producing wrong data, crashing, losing data, or blocking features. Security vulnerabilities that enable exploitation are also included.

**31 of 45 gaps have been fixed.** Remaining 14 are items requiring structural changes (rate limiting, API versioning, cluster mode, etc.) or are minor.

---

## 1. Critical Bugs

| # | Severity | Bug | File | Line | Status |
|---|----------|-----|------|------|--------|
| 1 | **MEDIUM** | `EquityPriceInfo.close` typed as `number` but pre-open API returns object in fallback — produces `[object Object]` | `src/equity-mappers.ts` | 173 | open |
| 2 | **LOW** | `symbolInfoCache` and `sortedSymbolsCache` never invalidated — stale data after corporate actions until restart | `src/index.ts` | 136-137 | **(fixed)** |

---

## 2. API & Data Layer

### 2.1 Missing Error Handling (Silent Failures / Wrong Data)
- `getIndexIntradayData` returns malformed data on shape mismatch instead of error (`src/index.ts:834-836`) **(fixed)**
- `getEquitySeries` silently returns `{data: []}` on API failure (`src/index.ts:792`) **(fixed)**
- `getEquityHistoricalData` silently returns empty arrays from date chunks instead of propagating errors (`src/index.ts:768`) **(fixed)**
- `warmNsePage` throws on non-403/502/503 status codes even though it's best-effort — can crash request during warmup (`src/index.ts:199-205`) **(fixed)**
- `bootstrapNseSession` assumes homepage fetch succeeded with no response validation — could silently use bad session (`src/index.ts:233-241`) **(fixed)**
- `loadMemoryFromFile` silently swallows all non-ENOENT errors — loses session data silently (`src/mcp/memory-manager.ts:491-495`) **(fixed)**

### 2.2 Missing Input Validation (Can Crash / Leak)
- No symbol validation on any equity endpoint — symbols taken raw from `req.params` (`src/routes.ts:362-830`) **(fixed)**
- No request body validation for MCP POST endpoints — `temperature`, `max_tokens`, `maxIterations` have no type/range checks (`src/routes.ts:1432-1502`) **(fixed)**
- No `query` parameter validation on chart endpoints (`src/routes.ts:1158-1216`) **(fixed)**
- `MemoryManager` session IDs not sanitized — potential session pollution (`src/mcp/memory-manager.ts:126-174`) **(fixed)**

### 2.3 Performance (Can Overwhelm / OOM)
- `getEquityHistoricalData` can fire ~195 parallel HTTP requests (stocks listed in 1990, 66-day chunks) (`src/index.ts:777`) **(fixed)**
- `symbolInfoCache` and `preOpenCache` never invalidated — memory leak over time **(fixed)**

### 2.4 Security (Can Be Exploited)
- No rate limiting on any REST endpoint — open
- `validateApiKey` accepts empty key when `OPENAI_BASE_URL` is set — auth bypass (`src/routes.ts:16`) **(fixed)**
- OpenAI API key exposed in error responses (500 error leaks infrastructure details) (`src/routes.ts:1463-1467`) **(fixed)**

### 2.5 Missing Features
- No health check endpoint — orchestration/load balancers cannot probe liveness **(fixed)**

---

## 3. Frontend / Dashboard

### 3.1 Security (XSS) — 8 Issues
- Symbol autocomplete renders `data-value="${s}"` without HTML escaping (`app.js:264-265`) **(fixed)**
- Index select options interpolate `key` and `label` raw into HTML (`app.js:900-903`) **(fixed)**
- Gainers & losers render `sym` without escapeHtml (`app.js:1041-1059`) **(fixed)**
- Most active table renders `s.symbol` without escapeHtml (`app.js:1085-1096`) **(fixed)**
- All indices tables and key indices grid render `i.index` without escapeHtml (`app.js:503-504`, `app.js:474-479`) **(fixed)**
- Missing Subresource Integrity on CDN scripts (`index.html:507-508`) **(fixed)**
- No Content Security Policy meta tag (`index.html`) — open
- Internal error messages leaked to user (`detailRes.reason?.message`) (`app.js:658-659`) **(fixed)**

### 3.2 Bugs (Wrong Data / Broken Features)
- Intraday variable `vols` holds timestamps not volumes — no volume data ever read, feature broken (`app.js:848-851`) **(fixed)**
- Loading state skipped for containers with `empty-msg` class — user sees stale empty message (`app.js:640-645`) **(fixed)**
- Auto-refresh misses holiday and turnover data — those sections show stale data (`app.js:359-363`) **(fixed)**
- Export fails silently for tables without `data-fullData` — most sections not covered (`app.js:216-231`) **(fixed)**
- Options date parsing is fragile: hardcoded month mapping, any unexpected format breaks sorting (`app.js:1178`) **(fixed)**
- Symbol cache never invalidated — newly listed stocks invisible until page reload (`app.js:244-248`) — open
- `formatRelativeTime` has no date validation — invalid dates produce NaN (`app.js:1965-1976`) **(fixed)**
- Race condition on rapid searches — last response wins, not last request sent; no `AbortController` (`app.js:635-677`) **(fixed)**

### 3.3 Runtime Stability
- No global error boundary (`window.onerror`/`unhandledrejection`) — uncaught exceptions break entire UI **(fixed)**
- No network retry logic — single attempt, transient failures cause permanent errors (`app.js:65-80`) **(fixed)**
- Unbounded cache (`new Map()`) with no max size or LRU eviction — memory leak (`app.js:40`) **(fixed)**
- Intervals never cleaned on page unload — memory leak in SPA context **(fixed)**

### 3.4 Configurability
- Port probing list hardcoded — not configurable (`app.js:8-9`) **(fixed)**

---

## 4. MCP / AI Subsystem

### 4.1 Critical Runtime Issues
- **No timeouts on any OpenAI API calls** (summarization, chat completion) — requests hang indefinitely (`src/mcp/context-summarizer.ts:178-193`, `src/mcp/client/mcp-client.ts:313-455`) **(fixed)**
- **Shared singleton state causes request pollution** across concurrent HTTP requests (`src/mcp/client/mcp-client.ts:989-1000`) **(fixed)**
- **`/api/mcp/test` costs real money** — calls `processQuery` which invokes paid OpenAI API (`src/mcp/client/mcp-client.ts:893-904`) **(fixed)**
- **No rate limiting on MCP endpoints** — single user can trigger unlimited paid API calls (`src/routes.ts:1432+`) — open
- **No retry logic** for OpenAI transient failures (429 rate limits, 500 errors) (`src/mcp/client/mcp-client.ts:313-455`) **(fixed)**

### 4.2 Memory & Context (OOM Risk / Config Breakage)
- **Memory leak**: `summarizationHistory` accumulates `originalMessages` references — each summarization stores full copies of up to 50 messages (`src/mcp/memory-manager.ts:184-189`) **(fixed)**
- `getContextSummarizer` ignores `OPENAI_BASE_URL` — summarization always uses OpenAI servers, ignores configured provider (`src/mcp/memory-manager.ts:109-118`) **(fixed)**

### 4.3 Security & Access Control
- No authentication on any MCP endpoint — publicly accessible **(fixed)**
- MCP stdio server has zero access control — open

### 4.4 Tool & Server (Crash / Hang / Wrong Results)
- MCP `tools/list` returns all 30 tools with no pagination/filtering — can overwhelm clients (`src/mcp/server/mcp-server.ts:91`) — open
- Single-threaded MCP server blocks on tool calls — no parallel processing (`src/mcp/server/mcp-server.ts:150-161`) — open
- No tool timeout enforcement — slow NSE call blocks server indefinitely (`src/mcp/server/mcp-server.ts:150-162`) **(fixed)**
- No graceful shutdown — pending operations abandoned on exit (`src/mcp/server/mcp-server.ts:37-39`) **(fixed)**
- Missing error boundary per tool call — crash in one handler could take down server (`src/mcp/server/mcp-server.ts:120-125`) **(fixed)**
- `shouldContinueIterating` heuristic is fragile and expensive — keyword matching triggers unnecessary API calls (`src/mcp/client/mcp-client.ts:553-601`) — open
- No cost tracking or budget enforcement — single query can make 5+ paid API calls (`src/mcp/client/mcp-client.ts:200-531`) **(fixed)**
- Instance state leakage: `currentQuery` and `allToolsUsed` shared across concurrent requests (`src/mcp/client/mcp-client.ts:67-68`) **(fixed)**

---

## 5. Configuration & Infrastructure

### 5.1 Server Configuration (Crash / Unmonitorable)
- **No graceful shutdown** — no SIGTERM/SIGINT handlers (`src/server.ts`) **(fixed)**
- **No health check endpoint** — `/health`, `/ready`, `/live` all missing **(fixed)**
- **No cluster mode or worker threads** — single-process, single-core — open
- **No PM2/process manager config** for production — no auto-restart on crash — open
- Apollo Studio CORS regex only allows Apollo Studio, not other GraphQL clients — blocks non-Apollo GraphQL consumers **(fixed)**

### 5.2 Docker (Deployment / Security)
- Missing `.dockerignore` — builds send entire repo including secrets **(fixed)**
- Base image not pinned to digest — non-reproducible builds **(fixed)**
- Docker image tagged with `imcodeman/nseindia` but repo is `unn-Known1/stock-nse-india` — pushes to wrong registry **(fixed)**

### 5.3 Environment & Config (Silent Failure / Breaking Changes)
- No configuration validation at startup — server starts but fails at runtime **(fixed)**
- No API versioning — all routes under `/api/` with no version prefix; breaking changes break all consumers — open
- README documents wrong CORS default (`*` vs empty array `[]`) — misconfiguration risk **(fixed)**
- No `.env.example` file documenting all env vars **(fixed)**

### 5.4 Repository (Reliability / Safety)
- Both `yarn.lock` and `package-lock.json` checked in — mixing package managers can cause dependency conflicts **(fixed)**
- `launch.sh` kills processes by port without verification — kills unrelated services **(fixed)**

### 5.5 CI/CD (Deployment Blockers)
- **GPR publish** targets wrong org (`@hi-imcodeman` vs `@unn-Known1`) (`gpr_publish.yml`) — cannot publish to GitHub Packages **(fixed)**
- Docker publish triggers on *every* push to master — wasteful, no release-gating **(fixed)**
- Outdated GitHub Actions versions (checkout@v2, setup-node@v1) — **(fixed)**
- No dependency caching in CI — **(fixed)**
- npm publish not gated on tests — **(fixed)**
- E2E workflow no weekend/holiday skip — **(fixed)**

---

## Top 10 Most Critical (Remaining)

| Rank | Issue | Impact | Status |
|------|-------|--------|--------|
| 1 | No rate limiting on any endpoint | Trivial DoS; unlimited paid API spend | open |
| 2 | No CSP meta tag in dashboard | XSS protection incomplete | open |
| 3 | No cluster mode or worker threads | Single-core only | open |
| 4 | No PM2/process manager | No auto-restart on crash | open |
| 5 | No API versioning | Breaking changes break all consumers | open |
| 6 | Symbol cache never invalidated (dashboard) | Misses new stocks until page reload | open |
| 7 | MCP tools/list no pagination | Can overwhelm clients with 30+ tools | open |
| 8 | Single-threaded MCP server | Blocks on long tool calls | open |
| 9 | `EquityPriceInfo.close` type mismatch | Produces `[object Object]` in pre-open | open |
| 10 | shouldContinueIterating fragile | Unnecessary paid API calls | open |

---

*Filtered from the full audit — only includes gaps that limit or restrict app functionality.*  
*Last updated: 2026-05-28 — 31 of 45 gaps fixed, 14 remaining.*
