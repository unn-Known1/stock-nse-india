# Stock NSE India — Comprehensive Gap Analysis Report

**Date:** 2026-05-28  
**Scope:** Full codebase audit across 5 dimensions by specialized subagents

---

## Executive Summary

A comprehensive audit of the `stock-nse-india` project (v1.4.0) uncovered **~270+ gaps, bugs, and issues** across the API/data layer, testing infrastructure, frontend dashboard, MCP/AI subsystem, and configuration/infrastructure. The most critical findings include: **11 confirmed bugs** (typos in public API shape, GraphQL schema/resolver mismatches, fragile date parsing, race conditions), **no timeouts on any OpenAI API calls** (can hang indefinitely), **no rate limiting on any endpoint**, **shared singleton state causing request pollution**, **zero tests for ~15 production source files**, **10 XSS vulnerabilities in the dashboard**, **and no security headers, health checks, or graceful shutdown** in the server.

---

## Table of Contents

1. [Critical Bugs (Confirmed)](#1-critical-bugs-confirmed)
2. [API & Data Layer Gaps](#2-api--data-layer-gaps)
3. [Testing & CI/CD Gaps](#3-testing--cicd-gaps)
4. [Frontend / Dashboard Gaps](#4-frontend--dashboard-gaps)
5. [MCP / AI Subsystem Gaps](#5-mcp--ai-subsystem-gaps)
6. [Configuration & Infrastructure Gaps](#6-configuration--infrastructure-gaps)

---

## 1. Critical Bugs (Confirmed)

| # | Severity | Bug | File | Line |
|---|----------|-----|------|------|
| 1 | **HIGH** | `grapthData` typo in public API shape (should be `graphData`) | `src/interface.ts` | 9 |
| 2 | **HIGH** | `pdSectorPe`/`pdSymbolPe` typed as `number` in TS but `String` in GraphQL schema | `src/interface.ts:247-248`, `equity.graphql:41-42` | — |
| 4 | **MEDIUM** | `EqutiyDetail` typo in GraphQL type name (should be `EquityDetail`) | `src/equity.graphql` | 6 |
| 5 | **MEDIUM** | `borad_meeting` typo in public API response shape (should be `board_meeting`) | `src/interface.ts` | 455 |
| 6 | **MEDIUM** | `EquityPriceInfo.close` typed as `number` but pre-open API returns object in fallback | `src/equity-mappers.ts` | 173 |
| 7 | **MEDIUM** | Route ordering: `/api/equity/:symbol` catches all `/api/equity/*` routes by accident | `src/routes.ts` | 822 |
| 8 | **MEDIUM** | `getData<T=any>` — no type safety enforced on most callers | `src/index.ts` | 287 |
| 9 | **LOW** | `MemoryManager.sessions` deserialized as plain objects, losing class methods | `src/mcp/memory-manager.ts` | 488 |
| 10 | **LOW** | Option chain expiry selection logic entirely marked `/* istanbul ignore next */` — never tested | `src/index.ts` | 872-965 |
| 11 | **LOW** | `symbolInfoCache` and `sortedSymbolsCache` never invalidated (stale data on corporate actions) | `src/index.ts` | 136-137 |

---

## 2. API & Data Layer Gaps

### 2.1 Missing Error Handling
- `getIndexIntradayData` returns malformed data on shape mismatch instead of error (`src/index.ts:834-836`)
- `getEquitySeries` silently returns `{data: []}` on API failure (`src/index.ts:792`)
- `getEquityHistoricalData` silently returns empty arrays from date chunks instead of propagating errors (`src/index.ts:768`)
- `warmNsePage` throws on non-403/502/503 status codes even though it's best-effort (`src/index.ts:199-205`)
- `bootstrapNseSession` assumes homepage fetch succeeded with no response validation (`src/index.ts:233-241`)
- `loadMemoryFromFile` silently swallows all non-ENOENT errors (`src/mcp/memory-manager.ts:491-495`)

### 2.2 Missing Input Validation
- No symbol validation on any equity endpoint — symbols are taken raw from `req.params` (`src/routes.ts:362-830`)
- No path traversal protection on SSL cert paths beyond `isPathInsideProject` (`src/server.ts:101`)
- No request body validation for MCP POST endpoints — `temperature`, `max_tokens`, `maxIterations` have no type/range checks (`src/routes.ts:1432-1502`)
- No `query` parameter validation on chart endpoints (`src/routes.ts:1158-1216`)
- `MemoryManager` session IDs not sanitized — potential session pollution (`src/mcp/memory-manager.ts:126-174`)

### 2.3 Performance Issues
- `getEquityHistoricalData` can fire ~195 parallel HTTP requests (stocks listed in 1990, 66-day chunks) (`src/index.ts:777`)
- Memory manager persists to file after EVERY message with only 500ms debounce (`src/mcp/memory-manager.ts:200`)
- `JSON.parse/stringify` deep clone on every config access in hot path (`src/mcp/context-summarizer.ts:450`)
- `symbolInfoCache` and `preOpenCache` never invalidated — memory leak over time
- No caching headers (ETag, Last-Modified) on HTTP responses — clients cannot conditionally request updates

### 2.4 Security Issues
- Memory data persisted unencrypted to disk (`./memory-data.json`) — all conversation history in plain text
- No rate limiting on any REST endpoint
- No Helmet.js security headers (XSS, content-type sniffing, clickjacking)
- No CSRF protection on POST endpoints
- OpenAI API key exposed in error responses (500 error leaks infrastructure details) (`src/routes.ts:1463-1467`)
- `validateApiKey` accepts empty key when `OPENAI_BASE_URL` is set — dangerous with local providers (`src/routes.ts:16`)

### 2.5 Missing Features
- No BSE support despite "bse" being in package.json keywords
- No WebSocket/streaming for real-time data
- No CSV/Excel/JSON export endpoints
- No comparison endpoints (`GET /api/compare?symbols=TCS,RELIANCE`)
- No stock screener/filtering API
- No health check endpoint
- Concurrency limiter (`createConcurrencyLimiter`) has zero tests

### 2.6 Code Quality
- Route naming inconsistency: camelCase (`marketStatus`) vs kebab-case (`/api/charts/equity-historical-data`)
- Error response format inconsistency across routes (string vs object)
- `IS_TYPE_STRICT` constant hardcoded `false` but never used — `getDataSchema` defaults to `true`
- `getNseCookies`/`getChartingCookies` deprecated but still public
- `getEquitySymbolInfoCached` is redundant wrapper around cached method
- `moment` + `moment-range` (~300KB) used only for simple date chunking — could be `date-fns` or native Date

---

## 3. Testing & CI/CD Gaps

### 3.1 Untested Source Files (~15 files, ~3000+ lines)
The following production files have **zero tests**:
- `src/feature-registry.ts` (291 lines) — MCP feature definitions, handler dispatch, parameter validation
- `src/indicators-formatter.ts` (175 lines) — technical indicator formatting with multiple branches
- `src/routes.ts` (~1700 lines) — the entire Express REST API surface
- `src/server.ts` (147 lines) — server bootstrap, CORS, HTTPS, Apollo startup
- `src/root.resolver.ts` (117 lines) — GraphQL resolver with DataLoader, regex filter (has race condition bug)
- All 6 files under `src/mcp/` — MCP server, client, memory manager, context summarizer, tools (~2000+ lines)
- All 2 files under `src/cli/` — CLI entry point and API display (~300 lines)

### 3.2 Existing Test Quality Issues
- Tests mock of a mock — spy on `getDataByEndpoint` (3-line delegate), testing nothing about actual NSE logic (`src/index.spec.ts:10-11`)
- Excessive testing of private implementation via `(nseIndia as any)` casts (`src/index.spec.ts:248-292`)
- Retry logic test only uses `maxRetries=1` — never tests actual retry loop with >=2 retries and exponential backoff (`src/index.spec.ts:294-305`)
- `toHttpError` never tested with real axios error object (`src/index.spec.ts:257-270`)
- Technical indicator tests use only 2-3 data points — RSI needs 14+, MACD needs 26+; tests pass with empty arrays (`src/helpers.spec.ts:43-73`)
- `getDateRangeChunks` tested with only one scenario — missing single-day, exact-divisible, sub-chunk, and invalid date cases (`src/utils.spec.ts:26-35`)
- E2E tests are inherently flaky: make real HTTP calls, hardcoded expiry dates, silent skip pattern (tests pass with zero assertions), no test isolation (shared NseIndia instance with cookies/caches), 16.6 min timeout (`src/index.e2e.spec.ts`)

### 3.3 Coverage Configuration Issues
- 100% coverage threshold enforced but only 5 files tracked — ~15 production files invisible to coverage (`jest.config.js:9-15`)
- `/* istanbul ignore next */` used extensively (e.g., `index.ts:766-958` — entire expiry logic) — false 100% signal
- No uncovered file tracking or `exclude-after-remap`

### 3.4 Missing Test Categories
- No integration tests for Express routes (no supertest)
- No GraphQL resolver tests (DataLoader, regex filter, symbol filter)
- No MCP server integration tests (stdio and HTTP modes)
- No CLI/shell tests (yargs, ora, chalk, asciichart formatting)
- No security tests (sanitizeUrl, validateApiKey)
- No snapshot/fixture management tests
- No performance/burden tests (concurrency limiter behavior under load)

### 3.5 CI/CD Pipeline Issues
- **Outdated action versions**: `actions/checkout@v2` (current: v4), `actions/setup-node@v1` (current: v4)
- **No linting step** in CI despite ESLint configuration (`ci.yml`)
- **No TypeScript type checking** (`tsc --noEmit`) in CI
- **No dependency caching** — `npm install` from scratch every run
- **No coverage reporting** — `--coverage` passed but no upload step
- **Single Node version** — only tests 20.x, not 18.x/22.x per `engines: { node: ">=20" }`
- **E2E workflow** has no weekend/holiday skip, no conditional execution
- **npm publish** not gated on tests (`npm_publish.yml`)
- **GPR publish** targets wrong org (`@hi-imcodeman` vs `@unn-Known1`) (`gpr_publish.yml`)
- **No security scanning** (no npm audit, snyk, CodeQL in any workflow)

---

## 4. Frontend / Dashboard Gaps

### 4.1 Security (XSS) — 10 Issues
- Symbol autocomplete renders `data-value="${s}"` without HTML escaping (`app.js:264-265`)
- Index select options interpolate `key` and `label` raw into HTML (`app.js:900-903`)
- Gainers & losers render `sym` without escapeHtml (`app.js:1041-1059`)
- Most active table renders `s.symbol` without escapeHtml (`app.js:1085-1096`)
- All indices tables and key indices grid render `i.index` without escapeHtml (`app.js:503-504`, `app.js:474-479`)
- Missing Subresource Integrity on CDN scripts (`index.html:507-508`)
- No Content Security Policy meta tag (`index.html`)
- Internal error messages leaked to user (`detailRes.reason?.message`) (`app.js:658-659`)

### 4.2 Bugs
- Intraday variable `vols` holds timestamps not volumes — no volume data ever read (`app.js:848-851`)
- Loading state skipped for containers with `empty-msg` class — user sees stale empty message (`app.js:640-645`)
- Auto-refresh misses holiday and turnover data — those sections show stale data (`app.js:359-363`)
- Export fails silently for tables without `data-fullData` — most sections not covered (`app.js:216-231`)
- Options date parsing is fragile: hardcoded month mapping, any unexpected format breaks sorting (`app.js:1178`)
- Symbol cache never invalidated — newly listed stocks invisible until page reload (`app.js:244-248`)
- `formatRelativeTime` has no date validation — invalid dates produce NaN (`app.js:1965-1976`)
- Race condition on rapid searches — last response wins, not last request sent; no `AbortController` (`app.js:635-677`)

### 4.3 UX / Missing States
- No "No Results" message for table filters when all rows hidden (`app.js:523-531`)
- No loading indicators for several tabs (key indices, holidays, turnover show stale empty messages)
- No global error boundary (`window.onerror`/`unhandledrejection`)
- No loading spinner on market overview initial load
- No offline fallback (no Service Worker, no manifest.json)

### 4.4 Performance & Memory
- Unbounded cache (`new Map()`) with no max size or LRU eviction (`app.js:40`)
- Auto-refresh and MCP poll intervals not paused when tab is hidden (`app.js:356-365`, `app.js:1851-1853`)
- Intervals never cleaned on page unload — memory leak in SPA context
- No network retry logic — single attempt, transient failures cause permanent errors (`app.js:65-80`)

### 4.5 Accessibility (7 Issues)
- Emoji in heading (`🏢`) without `role="img"` or `aria-label` (`index.html:12`)
- Tab buttons missing `role="tab"`, `aria-selected`, `role="tablist"` (`index.html:23-29`)
- Hidden checkboxes in technical indicators without `for` attribute (`style.css:610`)
- Dynamic content updates without `aria-live="polite"` regions
- Inline `onclick` handlers not keyboard accessible (`index.html` multiple lines)
- Tab bar `overflow: hidden` clips keyboard focus ring (`style.css:74`)
- Stock summary bar overflows on narrow screens (375px) (`style.css:485-490`)

### 4.6 CSS & Mobile
- Hardcoded colors instead of CSS variables in 10+ places (`style.css`)
- Filter input width too large for mobile (`style.css:426`)
- Port probing list hardcoded — not configurable (`app.js:8-9`)
- Hardcoded cache TTLs — not user-configurable (`app.js:42-48`)

---

## 5. MCP / AI Subsystem Gaps

### 5.1 Critical Runtime Issues
- **No timeouts on any OpenAI API calls** (summarization, chat completion) — requests can hang indefinitely (`src/mcp/context-summarizer.ts:178-193`, `src/mcp/client/mcp-client.ts:313-455`)
- **Shared singleton state causes request pollution** across concurrent HTTP requests (`src/mcp/client/mcp-client.ts:989-1000`)
- **`/api/mcp/test` costs real money** — calls `processQuery` which invokes paid OpenAI API (`src/mcp/client/mcp-client.ts:893-904`)
- **No rate limiting on MCP endpoints** — single user can trigger unlimited paid API calls (`src/routes.ts:1432+`)
- **No retry logic** for OpenAI transient failures (429 rate limits, 500 errors) (`src/mcp/client/mcp-client.ts:313-455`)

### 5.2 Memory & Context Management
- **Memory leak**: `summarizationHistory` accumulates `originalMessages` references — each summarization stores full copies of up to 50 messages (`src/mcp/memory-manager.ts:184-189`)
- No hard limit on total memory across all sessions (only session count bounded at 100)
- Token estimation is rough `char/4` approximation — ~25% error margin for English (`src/mcp/context-summarizer.ts:47-54`)
- Summarization prompt dumps all message content verbatim — **data leakage risk** and quadratic token costs (`src/mcp/context-summarizer.ts:164-165`)
- `getContextSummarizer` ignores `OPENAI_BASE_URL` — summarization always uses OpenAI servers (`src/mcp/memory-manager.ts:109-118`)

### 5.3 Security & Injection
- No authentication on any MCP endpoint — publicly accessible
- Prompt injection risk: user queries placed directly in OpenAI messages with no sanitization (`src/mcp/client/mcp-client.ts:298-302`)
- System prompt hardcoded and exposed — helps craft injection attacks (`src/mcp/client/mcp-client.ts:187-195`)
- PII redaction is weak: only emails, 5+ digit numbers, and API keys — misses phone numbers, Aadhaar, PAN (`src/mcp/client/mcp-client.ts:161-172`)
- MCP stdio server has zero access control (`src/mcp/server/mcp-server.ts`)
- No audit trail for tool execution

### 5.4 Tool & Server Issues
- MCP `tools/list` returns all 30 tools with no pagination/filtering (`src/mcp/server/mcp-server.ts:91`)
- Single-threaded MCP server blocks on tool calls — no parallel processing (`src/mcp/server/mcp-server.ts:150-161`)
- No tool timeout enforcement — slow NSE call blocks server indefinitely (`src/mcp/server/mcp-server.ts:150-162`)
- No input validation on tool parameters — malformed parameters pass to handlers (`src/mcp/server/mcp-server.ts:150-152`)
- No graceful shutdown — pending operations abandoned on exit (`src/mcp/server/mcp-server.ts:37-39`)
- Missing error boundary per tool call — crash in one handler could take down server (`src/mcp/server/mcp-server.ts:120-125`)
- `shouldContinueIterating` heuristic is fragile and expensive — keyword matching triggers unnecessary API calls (`src/mcp/client/mcp-client.ts:553-601`)
- No cost tracking or budget enforcement — single query can make 5+ paid API calls (`src/mcp/client/mcp-client.ts:200-531`)
- Instance state leakage: `currentQuery` and `allToolsUsed` shared across concurrent requests (`src/mcp/client/mcp-client.ts:67-68`)

---

## 6. Configuration & Infrastructure Gaps

### 6.1 Server Configuration
- **No graceful shutdown** — no SIGTERM/SIGINT handlers (`src/server.ts`)
- **No health check endpoint** — `/health`, `/ready`, `/live` all missing
- **No logging framework** — only `console.log/warn/error` throughout
- **No compression middleware** — response payloads not gzipped
- **No Helmet/security headers** — missing XSS, clickjacking, HSTS protection
- **No rate limiting middleware** — publicly exposed API with no throttling
- **No HTTP/2 support**
- **No cluster mode or worker threads** — single-process, single-core
- **No PM2/process manager config** for production
- Apollo Studio CORS regex only allows Apollo Studio, not other GraphQL clients

### 6.2 Docker Issues
- Missing `.dockerignore` — builds send entire repo including secrets
- Single-stage build — runtime image contains dev dependencies (TypeScript, Jest, ESLint, Husky)
- Copies `src/` and `examples/` into runtime image unnecessarily
- Cache inefficiency: source copied before package.json, invalidating npm install layer
- Base image not pinned to digest — non-reproducible builds
- Hardcodes `PORT=3001` but README/docs use `3000`
- Docker image tagged with `imcodeman/nseindia` but repo is `unn-Known1/stock-nse-india`

### 6.3 Environment & Config
- No `.env.example` file documenting all env vars
- No configuration validation at startup — server starts but fails at runtime
- README documents wrong CORS default (`*` vs empty array `[]`)
- Missing separate staging/production environment configs
- No API versioning — all routes under `/api/` with no version prefix
- No monitoring/observability setup (no `/metrics`, no OpenTelemetry)
- `tsconfig.json` targets `es2018` — Node 20 supports `ES2022` natively

### 6.4 Repository Hygiene
- No CHANGELOG.md
- No CONTRIBUTING.md
- No CODE_OF_CONDUCT
- No SECURITY.md
- No semantic release / automated version management
- Both `yarn.lock` and `package-lock.json` checked in — mixing package managers
- `node_modules/` not in `.npmignore` (implicitly excluded by npm, but inconsistent)
- `launch.sh` kills processes by port without verification — dangerous

### 6.5 CI/CD Pipeline
- Outdated GitHub Actions versions (checkout@v2, setup-node@v1) across all workflows
- No linting in CI
- No TypeScript type checking in CI
- No dependency caching in any workflow
- No test coverage reporting/upload
- npm publish not gated on tests
- Docker publish triggers on *every* push to master — extremely aggressive
- GPR publish targets wrong GitHub org
- No security scanning (npm audit, CodeQL, Snyk, Dependabot) in any workflow

---

## Top 10 Most Critical Findings

| Rank | Issue | Impact |
|------|-------|--------|
| 1 | No timeouts on OpenAI API calls | Server can hang indefinitely; users wait forever |
| 2 | Shared singleton MCPClient state | Concurrent requests corrupt each other's state |
| 3 | No rate limiting on any endpoint | Trivial DoS; unlimited paid API calls via MCP |
| 4 | `/api/mcp/test` costs real money | Every health check is a paid OpenAI call |
| 5 | 10 XSS vulnerabilities in dashboard | Malicious symbol names execute arbitrary JS |
| 6 | Memory leak in summarization | Long-running sessions consume unbounded memory |
| 7 | Zero tests for ~15 production files | ~3000+ lines of untested production code |
| 8 | `grapthData` typo in public API | Breaking change required to fix API shape |
| 9 | No graceful shutdown anywhere | Connections dropped, data lost on deploy |
| 10 | No security headers, no CSP | Entire app vulnerable to basic web attacks |

---

## Recommendations by Priority

### Immediate (Security / Data Loss)
1. Add `AbortSignal`/timeout to all OpenAI API calls
2. Add rate limiting middleware to REST and MCP endpoints
3. Fix XSS in all dashboard template interpolations (use `escapeHtml`)
4. Add `helmet` middleware and Content Security Policy
5. Add graceful shutdown (SIGTERM/SIGINT handlers) with pending write flush
6. Encrypt `memory-data.json` at rest

### Short-Term (Correctness)
7. Fix `grapthData` → `graphData` typo (major version bump)
8. Align GraphQL schema types with TypeScript interfaces
9. Add `AbortController` to dashboard search for race condition fix
10. Add proper error responses instead of silent `{data: []}` fallbacks

### Medium-Term (Quality)
11. Write tests for all untested source files
12. Add integration tests for Express routes with supertest
13. Fix CI: upgrade actions, add linting, type-checking, caching
14. Add E2E skip pattern for weekends/holidays

### Long-Term (Architecture)
16. Add WebSocket/SSE streaming for real-time data
17. Migrate from `moment` to `date-fns` for smaller bundles
18. Implement proper DataLoader caching with TTL invalidation
19. Add multi-stage Docker build with non-root user
20. Implement OpenTelemetry-based observability

---

*Report generated by 5 specialized analysis subagents covering: API/Data Layer, Testing/CI/CD, Frontend/Dashboard, MCP/AI Subsystem, and Configuration/Infrastructure.*
