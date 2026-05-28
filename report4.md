# Stock-NSE-India — Comprehensive Gap Analysis

**Project:** `stock-nse-india` v1.4.0  
**Date:** 2026-05-28  
**Scope:** Full codebase audit by 4 parallel agents (Security, Code Quality, API/Integration, Performance/Reliability)  
**Total findings:** 108

---

## SEVERITY DISTRIBUTION

| Severity | Security | Code Quality | API/Integration | Performance | Total |
|----------|----------|-------------|-----------------|-------------|-------|
| CRITICAL | 4 | 5 | 2 | 9 | **20** |
| HIGH     | 8 | 9 | 2 | 6 | **25** |
| MEDIUM   | 10 | 12 | 6 | 8 | **36** |
| LOW      | 4 | 10 | 12 | 1 | **27** |
| **Total** | **26** | **36** | **22** | **24** | **108** |

---

## CRITICAL FINDINGS (20)

### C-1: No authentication on any MCP endpoint — OpenAI credit drain risk
**Severity:** CRITICAL | **Source:** Security  
**Files:** `src/routes.ts:1563-1630`, `src/routes.ts:1664-1674`, `src/routes.ts:1704-1737`, `src/routes.ts:1834-1852`, `src/routes.ts:1986-2003`, `src/routes.ts:2025-2041`, `src/routes.ts:2063-2081`

All MCP REST endpoints (`/api/mcp/query`, `/api/mcp/tools`, `/api/mcp/test`, `/api/mcp/session/:sessionId`, `/api/mcp/session/:sessionId/export`, `/api/mcp/session/:sessionId/preferences`, `/api/mcp/session/:sessionId/clear`) are completely unauthenticated. An attacker can drain OpenAI API credits, export all session data, or modify any user's session.

**Fix:** Add API key auth middleware for all MCP routes, implement IP-based rate limiting, set request body size limits.

---

### C-2: ReDoS via user-supplied RegExp in GraphQL resolver
**Severity:** CRITICAL | **Source:** Security  
**Files:** `src/root.resolver.ts:27-29`, `src/root.resolver.ts:56`, `src/inputs.graphql:3,13`

The `StringArrayFilter` and `ObjectFilter` GraphQL input types accept a user-supplied `regex` string passed directly to `new RegExp(regex)` without validation. Catastrophic backtracking payloads (e.g., `^(a+)+$`) cause Event Loop starvation.

**Fix:** Replace with `re2` library, add regex timeout wrapper, or remove `regex` from schema.

---

### C-3: Predictable auto-generated session IDs
**Severity:** CRITICAL | **Source:** Security  
**File:** `src/routes.ts:1586`

Session IDs use `Math.random().toString(36).substr(2, 9)` (~52 bits entropy) and are brute-forceable. Combined with no auth on session endpoints, attackers can access any session.

**Fix:** Use `crypto.randomUUID()`.

---

### C-4: Session data exported without authorization
**Severity:** CRITICAL | **Source:** Security  
**File:** `src/routes.ts:2063-2081`

`GET /api/mcp/session/:sessionId/export` returns full `UserSession` including `conversationHistory`, `userPreferences`, and `summarizationHistory` with zero auth.

**Fix:** Require authentication; sanitize exported data.

---

### C-5: `NseIndia` is a 1124-line God class
**Severity:** CRITICAL | **Source:** Code Quality  
**File:** `src/index.ts:89-1072`

Single Responsibility Principle violation. Handles session management, data fetching, caching, enrichment, charting, and technical indicator delegation. Nearly impossible to unit test or extend.

**Fix:** Extract `SessionManager`, `NseApiClient`, caching strategy objects, and `ChartingService`.

---

### C-6: Duplicated technical indicator rounding logic (~280 lines × 2)
**Severity:** CRITICAL | **Source:** Code Quality  
**Files:** `src/routes.ts:814-957`, `src/mcp/mcp-tools.ts:675-855`

Two independently maintained copies of identical `roundTo2Decimals`, `roundArrayTo2Decimals`, and full indicator post-processing pipeline. Any change must be made in both places.

**Fix:** Extract to shared `src/indicators-formatter.ts`.

---

### C-7: 38+ `any` type escapes in CLI layer
**Severity:** CRITICAL | **Source:** Code Quality  
**File:** `src/cli/api.ts` (lines 29, 42, 56, 57, 64, 84, 105, 108-109, 152, 171, 188-189, 191, 196 etc.), `src/cli/index.ts:44-75`

Entire CLI module uses `any` for all data structures. TypeScript strict mode offers zero protection here.

**Fix:** Add proper type annotations using `yargs.Arguments<>` and existing `interface.ts` types.

---

### C-8: `getData` returns `Promise<any>` — no type safety on primary data path
**Severity:** CRITICAL | **Source:** Code Quality  
**File:** `src/index.ts:273`

The single most-called method has no return type linkage. Every consumer must cast or assert.

**Fix:** Use generics: `async getData<T>(url, domain): Promise<T>`.

---

### C-9: `istanbul ignore next` comments everywhere (40+ instances)
**Severity:** CRITICAL | **Source:** Code Quality  
**Files:** `src/index.ts` (lines 719, 743, 785, 810-895 entire block), `src/helpers.ts` (lines 51-53, 76-96, 202-205)

Systematic exclusion of error handling, fallback paths, and edge cases from code coverage. Creates false confidence in untested code.

**Fix:** Remove all istanbul ignores; write tests for excluded branches; restructure unreachable code.

---

### ⭐ [NICE TO HAVE] C-10: GraphQL is ~93% incomplete
**Severity:** CRITICAL | **Source:** API/Integration  
**File:** `src/root.resolver.ts:62-85`

Only 2 of ~30+ capabilities are exposed via GraphQL (`equities` and `indices`). No trade info, corporate info, intraday, historical, options, technical indicators, charting, holidays, market turnover, circulars, gainers/losers, most active, or helpers.

**Fix:** Build out resolvers for all 28+ missing capabilities; use DataLoader for N+1 prevention.

---

### C-11: N+1 query problem in GraphQL `Equity.details`
**Severity:** CRITICAL | **Source:** API/Integration  
**File:** `src/root.resolver.ts:76-84`

Querying `{ equities { details { priceInfo } } }` with 2000+ symbols triggers 2000+ HTTP requests to NSE.

**Fix:** Use DataLoader for batching.

---

### C-12: No HTTP keep-alive agent on axios clients
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:104-105`

Every outbound request performs a fresh TCP handshake + TLS negotiation (~3-5 RTT), adding 60-150ms per call.

**Fix:** Configure `https.Agent` with `keepAlive: true`, `maxSockets: 10`, `keepAliveMsecs: 30000`.

---

### C-13: Busy-wait spinlock concurrency limiter
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:278-280`

`while (this.noOfConnections >= 5) { await sleep(500) }` — active spinlock polling every 500ms, burning CPU and adding 0-500ms tail latency.

**Fix:** Replace with proper semaphore using `p-limit` or promise-based queue.

---

### C-14: TOCTOU race condition on `noOfConnections`
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:278-281`

Between check and increment, multiple concurrent async functions can pass the guard, allowing 2-3x the intended connections.

**Fix:** Use `p-limit` or atomic counter; eliminate manual counter.

---

### C-15: Cache stampede — no mutex on pre-open / capital-market cache
**Severity:** CRITICAL | **Source:** Performance  
**Files:** `src/index.ts:451-457`, `src/index.ts:459-480`

50+ concurrent requests all detect expiry and fire identical API calls every 60 seconds. Periodic traffic spikes guarantee NSE rate limiting.

**Fix:** Promise-based dedup lock pattern.

---

### C-16: Fixed retries with zero backoff — retry storm risk
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:273-355`

All 3 retries fire back-to-back with no delay. Combined with cache stampede, produces 150 simultaneous requests.

**Fix:** Exponential backoff with jitter: `Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000)`.

---

### C-17: CookieJar and axios instance accumulation
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:119-127`

Each session invalidation creates new CookieJar + axios client. Old instances hold socket references preventing GC.

**Fix:** Reuse same axios instance; clear cookie jar instead of recreating.

---

### C-18: Synchronous `fs.writeFileSync` on every memory write
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/mcp/memory-manager.ts:413-427`

Called on EVERY user message and assistant response. Blocks event loop for 50-200ms per write. Under concurrent MCP users, event loop can block for seconds.

**Fix:** Async write with debouncing (2s interval).

---

### C-19: N+1 sequential HTTP dependency in charting flow
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/index.ts:386-405`

`getEquityChartHistoricalData` makes two sequential HTTP calls when token not provided (common case). 600-2000ms minimum per call.

**Fix:** Pre-fetch and cache symbol info map.

---

### C-20: Unbounded in-memory session storage
**Severity:** CRITICAL | **Source:** Performance  
**File:** `src/mcp/memory-manager.ts:70`

`Map<string, UserSession>` with no eviction to disk. Each session stores `conversationHistory` (50 msgs) + `summarizationHistory` (10 records with full `originalMessages`). 1,000 sessions = 100-500MB heap.

**Fix:** Session eviction to SQLite/Redis; reduce `maxConversationHistory`; don't store `originalMessages` in summarization records.

---

## HIGH FINDINGS (25)

### H-1: No rate limiting on any endpoint
**Severity:** HIGH | **Source:** Security  
**Files:** `src/server.ts`, `src/routes.ts`

Enables OpenAI credit exhaustion, NSE API abuse, and brute-force attacks.

**Fix:** Add `express-rate-limit` middleware.

---

### H-2: Sensitive data persisted to disk in plaintext
**Severity:** HIGH | **Source:** Security  
**File:** `src/mcp/memory-manager.ts:413-427`

Full conversation histories, investment preferences, and original messages written to `./memory-data.json` in unencrypted JSON.

**Fix:** Encrypt at rest; store in non-public directory; add `.gitignore` entry; set restrictive permissions.

---

### H-3: OpenAI API key leakage in error logs
**Severity:** HIGH | **Source:** Security  
**Files:** `src/routes.ts:1625`, `src/routes.ts:1669`, `src/routes.ts:1730`

Errors logged with raw `error` object may contain API keys in stack traces or response bodies.

**Fix:** Sanitize error objects before logging; use structured logging with redaction.

---

### H-4: NSE cookies stored as plaintext strings
**Severity:** HIGH | **Source:** Security  
**File:** `src/index.ts:107-114`

Cookies stored as plaintext class properties, vulnerable to memory dumps or serialization leaks.

**Fix:** Keep cookies in `CookieJar` only; add `toJSON()` excluding sensitive properties.

---

### H-5: Busy-wait blocks Event Loop
**Severity:** HIGH | **Source:** Security (also Performance C-13)  
**File:** `src/index.ts:278-280` — see C-13.

---

### H-6: GraphQL introspection enabled in production
**Severity:** HIGH | **Source:** Security  
**File:** `src/server.ts:104-108`

Apollo Server allows `__schema` queries in all environments. Combined with CORS for Apollo Studio, the entire API surface is exposed.

**Fix:** `introspection: process.env.NODE_ENV !== 'production'`.

---

### H-7: No request body size limits
**Severity:** HIGH | **Source:** Security  
**File:** `src/server.ts:63`

`express.json()` and `express.urlencoded()` used without size limits. Attackers can send arbitrarily large payloads.

**Fix:** `express.json({ limit: '100kb' })`.

---

### H-8: Session data pushed to OpenAI without PII scrub
**Severity:** HIGH | **Source:** Security  
**Files:** `src/mcp/client/mcp-client.ts:238-265`, `src/mcp/context-summarizer.ts:154-176`

Full conversation history including investment preferences sent to third-party AI as context.

**Fix:** Implement PII/anonymization filter; allow opt-out; display privacy notice.

---

### H-9: No HTTP request timeout on axios clients
**Severity:** HIGH | **Source:** Performance  
**File:** `src/index.ts:104-105`

Axios default timeout is 0 (infinite wait). A single hung request blocks a connection slot permanently.

**Fix:** Set `timeout: 15000` on both clients.

---

### H-10: Retry ignores 502/503 — most common NSE transient errors
**Severity:** HIGH | **Source:** Performance  
**File:** `src/index.ts:345-349`

502 and 503 treated as terminal failures. Availability drops during NSE load spikes.

**Fix:** Add 502/503 to retry condition with non-session-refresh continue.

---

### H-11: `Promise.all` fails fast on partial historical data errors
**Severity:** HIGH | **Source:** Performance  
**File:** `src/index.ts:712-731`

If one of 20 date-range chunks fails, the entire historical request fails.

**Fix:** Use `Promise.allSettled` with success filtering, or `p-map` with concurrency limit.

---

### H-12: No circuit breaker for NSE API
**Severity:** HIGH | **Source:** Performance  
**File:** `src/index.ts` (entire class)

Under NSE outage, all connection slots consumed by retrying requests that will fail. Healthy requests queue behind failing ones.

**Fix:** Implement circuit breaker pattern with configurable thresholds.

---

### H-13: `memory-data.json` corruption risk from concurrent writes
**Severity:** HIGH | **Source:** Performance  
**File:** `src/mcp/memory-manager.ts:413-427`

Multiple HTTP requests trigger simultaneous writes; second write overwrites first.

**Fix:** Atomic writes using temp file + rename.

---

### H-14: Race condition in `ensureNseSession` — double session bootstrap
**Severity:** HIGH | **Source:** Performance  
**File:** `src/index.ts:202-225`

10 concurrent requests all fire NSE homepage bootstrapping simultaneously. Burst of 5-10 unnecessary requests at every cache boundary.

**Fix:** Promise dedup pattern.

---

### H-15: Race condition in `getOrCreateSession`
**Severity:** HIGH | **Source:** Performance  
**File:** `src/mcp/memory-manager.ts:116-152`

Two concurrent requests with same new sessionId both create new session; one overwrites the other — data silently lost.

**Fix:** Check-then-act with `Map.has()` + `Map.set()` or lock pattern.

---

### H-16: Massive duplicated switch statements (REST routes vs MCP tools)
**Severity:** HIGH | **Source:** Code Quality  
**Files:** `src/routes.ts` (50+ route handlers), `src/mcp/mcp-tools.ts:458-940` (30+ switch cases)

Each feature requires changes in 3+ places (index.ts, routes.ts, mcp-tools.ts).

**Fix:** Registry pattern where tools and routes are auto-generated from a single metadata array.

---

### H-17: ADX indicator is a placeholder (all zeros)
**Severity:** HIGH | **Source:** Code Quality  
**File:** `src/helpers.ts:174`

`const adx = new Array(closes.length).fill(0)` — silently returns useless data to users.

**Fix:** Implement proper ADX or remove the field from the interface.

---

### ⭐ [NICE TO HAVE] H-18: `getIndexOptionChain` MCP tool missing `expiry` parameter
**Severity:** HIGH | **Source:** API/Integration  
**File:** `src/mcp/mcp-tools.ts:136-148`

The `get_index_option_chain` tool only has `index_symbol` param. REST endpoint also doesn't pass `expiry`. The NseIndia class already supports it.

**Fix:** Add `expiry` parameter to MCP tool and REST route query.

---

### ⭐ [NICE TO HAVE] H-19: CLI severely under-featured — 24 of ~32 capabilities missing
**Severity:** HIGH | **Source:** API/Integration  
**File:** `src/cli/index.ts:42-76`

Only 4 CLI commands exist (default, `equity`, `historical`, `index`, `mcp`). 24+ capabilities missing vs REST/MCP.

**Fix:** Add CLI commands for all missing capabilities; add `--from`/`--to` flags on `historical`.

---

### ⭐ [NICE TO HAVE] H-20: Route naming inconsistency and versioning broken
**Severity:** HIGH | **Source:** API/Integration  
**File:** `src/routes.ts` (multiple)

Mixed naming: `/api/equityMaster` (camelCase) vs `/api/equity/series/{symbol}` (nested) vs `/api/gainersAndLosers` (PascalCase). Only `/api/v1/swagger.json` uses version prefix.

**Fix:** Standardize naming convention; move all routes under `/api/v1/`.

---

### ⭐ [NICE TO HAVE] H-21: MCP server protocol compliance gaps
**Severity:** HIGH | **Source:** API/Integration  
**File:** `src/mcp/server/mcp-server.ts`

Missing required protocol methods: `resources/read`, `ping`, `$/progress`. `prompts/list` and `resources/list` return empty arrays.

**Fix:** Implement missing protocol methods per 2024-11-05 spec.

---

### H-22: `any` in `getTechnicalIndicators` options
**Severity:** HIGH | **Source:** Code Quality  
**File:** `src/routes.ts:782` — `const options: any = {}`

Options built as empty `any` object with no type validation against actual parameter types.

**Fix:** Define proper `TechnicalIndicatorOptions` type.

---

### H-23: Tests cast class under test as `any`
**Severity:** HIGH | **Source:** Code Quality  
**File:** `src/index.session.spec.ts:5` — `const nseIndia = new NseIndia() as any`

Tests access private methods via `any` cast. If methods are renamed, tests break silently.

**Fix:** Test through public API or extract session logic into testable class.

---

### H-24: `getIndexOptionChain` — massive istanbul-ignored block (85 lines)
**Severity:** HIGH | **Source:** Code Quality  
**File:** `src/index.ts:810-895`

Entire auto-expiry-selection logic excluded from coverage. Critical business logic untested.

**Fix:** Extract expiry-date-parsing into own function with tests.

---

### ⭐ [NICE TO HAVE] H-25: No graceful shutdown
**Severity:** HIGH | **Source:** Performance  
**Files:** `src/server.ts`, `src/mcp/server/mcp-server.ts`

No SIGTERM handling for Express server; Apollo Server drain plugin exists but no container-ready shutdown sequence.

**Fix:** Add `process.on('SIGTERM', ...)` for server close; add health check endpoint.

---

## MEDIUM FINDINGS (36)

### M-1: Missing HTTP security headers
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/server.ts`

No Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security.

**Fix:** Add `helmet` middleware.

---

### M-2: Overly permissive CORS configuration
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/server.ts:48-60`

Credentials enabled by default; broad localhost regex matches any port; `corsOrigins` can be empty.

**Fix:** Disable `credentials` unless required; require explicit CORS_ORIGINS config.

---

### ⭐ [NICE TO HAVE] M-3: OPENAI_API_KEY not in `.env.example`
**Severity:** MEDIUM | **Source:** Security  
**File:** `.env.example`

Missing critical config variable; `/api/mcp/query` returns 500 without it.

**Fix:** Add `OPENAI_API_KEY=` to `.env.example`.

---

### M-4: Error messages expose internal NSE API URLs
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/index.ts:151-155`

Error messages include full URL path with query parameters (symbols).

**Fix:** Sanitize error messages before sending to clients.

---

### M-5: HTTP mode by default
**Severity:** MEDIUM | **Source:** Security  
**Files:** `src/server.ts:22-23`, `.env.example:6`

Default HTTP mode. All traffic plaintext without HTTPS.

**Fix:** Default to HTTPS in production; add HSTS header.

---

### M-6: GraphQL schema advertises ReDoS-vulnerable filters
**Severity:** MEDIUM | **Source:** Security  
**Files:** `src/inputs.graphql`, `src/root.graphql`

`regex` field in GraphQL inputs visible via introspection.

**Fix:** Remove `regex` or replace with glob-style matching.

---

### M-7: No API key validation before OpenAI calls
**Severity:** MEDIUM | **Source:** Security  
**Files:** `src/mcp/client/mcp-client.ts:86-93`, `src/routes.ts:1588-1592`

Only checks key exists as non-empty string. No format/validity check.

**Fix:** Validate key format; lightweight API call at boot.

---

### M-8: Session timeout not enforced for memory persistence
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/mcp/memory-manager.ts:398-408`

Expired sessions never cleaned up from persisted file. `memory-data.json` accumulates stale data.

**Fix:** Periodic timer for cleanup; filter expired sessions on load.

---

### M-9: SSL key/cert path traversal risk
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/server.ts:85-86`

Environment variables for SSL paths can point to arbitrary files (e.g., `/etc/passwd`).

**Fix:** Validate paths are within allowed directory.

---

### M-10: Potential infinite loop in context optimization
**Severity:** MEDIUM | **Source:** Security  
**File:** `src/mcp/context-summarizer.ts:337-343`

While loop decrements but may never exit if token count exceeds target even at minimum messages.

**Fix:** Add exit guard when `recentMessageCount < 2`.

---

### ⭐ [NICE TO HAVE] M-11: God file — `routes.ts` (2525 lines)
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/routes.ts`

Every route, all MCP endpoints, and massive OpenAPI JSDoc in one file. Swagger docs account for ~70%.

**Fix:** Split into `routes/equity.ts`, `routes/index.ts`, `routes/mcp.ts`, `routes/common.ts`.

---

### M-12: `MCPClient` singleton anti-pattern
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/mcp/client/mcp-client.ts:958-969`

Global singleton shared across all requests. `enableDebugLogging` can be mutated race-condition-style.

**Fix:** Per-request instantiation or clone-safe configuration.

---

### M-13: `getConfig()` returns mutable references
**Severity:** MEDIUM | **Source:** Code Quality  
**Files:** `src/mcp/mcp-client.ts:900-902`, `src/mcp/context-summarizer.ts:445-447`

Shallow copies; nested objects still shared references.

**Fix:** Deep-clone or make fully immutable.

---

### ⭐ [NICE TO HAVE] M-14: `server.ts` — synchronous file I/O blocks startup
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/server.ts:70-71`

GraphQL schema/resolver loading uses `loadSchemaSync`/`loadFilesSync`, blocking Event Loop during startup.

**Fix:** Use async variants.

---

### ⭐ [NICE TO HAVE] M-15: Apollo Server 3 with deprecated plugin
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/server.ts:9`

Apollo Server 3 is EOL; `ApolloServerPluginDrainHttpServer` pattern changed in v4.

**Fix:** Upgrade to Apollo Server 4.

---

### ⭐ [NICE TO HAVE] M-16: Unused dependencies (`cheerio`, `mcp-remote`)
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `package.json:77,83`

Libraries never imported in src/ but inflate install size.

**Fix:** Remove if not required at runtime.

---

### ⭐ [NICE TO HAVE] M-17: `getDataSchema` utility is dead code
**Severity:** MEDIUM | **Source:** Code Quality  
**Files:** `src/utils.ts:38-68`, `src/constants.ts`

Snapshot-based API response validation function never called anywhere.

**Fix:** Remove dead code and `constants.ts`.

---

### ⭐ [NICE TO HAVE] M-18: `moment-range` is deprecated
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/utils.ts:1-4`

Legacy library; maintainers recommend `date-fns` or `Temporal`.

**Fix:** Replace with `date-fns` `eachDayOfInterval` and `format`.

---

### M-19: Error handling inconsistency — MCP routes vs REST routes
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/routes.ts`

REST uses `sendRouteError` (centralized); MCP uses ad-hoc `console.error` + manual 500 returns.

**Fix:** Unify under `sendRouteError` or middleware.

---

### M-20: `getIndexIntradayData` returns raw `any` shape
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/index.ts:786`

Return type is `Promise<IntradayData>` but fallback `response` is not validated.

**Fix:** Validate with `isIntradayDataShape` or map explicitly.

---

### M-21: `resolveCapitalMarketType` silently swallows errors
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/index.ts:477-479`

Silently returns `'NM'` on error, masking configuration issues.

**Fix:** Log warning before default.

---

### ⭐ [NICE TO HAVE] M-22: `getEquityHistoricalData` hardcoded 66-day chunk size
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/index.ts:711`

Magic number with no documentation or configurability.

**Fix:** Document rationale or make configurable.

---

### ⭐ [NICE TO HAVE] M-23: Missing OpenAPI tags
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `src/swaggerDocOptions.ts:48-50`

Tags array missing `Charting`, `MCP Client`, `MCP Memory` (all used in routes.ts).

**Fix:** Add missing tags.

---

### ⭐ [NICE TO HAVE] M-24: OpenAPI response schemas missing for ~80% of endpoints
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `src/routes.ts`

Only 3 of 30+ endpoints have detailed response schemas.

**Fix:** Define reusable OpenAPI components for all response types.

---

### ⭐ [NICE TO HAVE] M-25: `getDataByEndpoint` used directly instead of typed methods
**Severity:** MEDIUM | **Source:** API/Integration  
**Files:** `src/routes.ts:33,73,95,119,143,175-178,211-213,247-251,275,299`

10+ routes call `nseIndia.getDataByEndpoint(ApiList.X)` instead of `nseIndia.getX()`. Bypasses future caching/validation.

**Fix:** Use typed public methods.

---

### ⭐ [NICE TO HAVE] M-26: Dockerfile incomplete
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `Dockerfile`

Missing `.dockerignore`, `HEALTHCHECK`, non-root user. Copies `examples/` but not `demo/`.

**Fix:** Add all missing Docker best practices.

---

### M-27: Route conflict — `/api/equity/:symbol` catch-all
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `src/routes.ts:353`

If `:symbol` matches "series", `getEquityDetails` would process before hitting `/api/equity/series/:symbol`.

**Fix:** Reorder routes or use path prefix.

---

### ⭐ [NICE TO HAVE] M-28: No pagination on list endpoints
**Severity:** MEDIUM | **Source:** API/Integration  
**Files:** `src/routes.ts:321` (`/api/allSymbols`), `src/routes.ts:273` (`/api/allIndices`)

Returns complete datasets with no `offset`/`limit` support.

**Fix:** Add pagination parameters.

---

### ⭐ [NICE TO HAVE] M-29: Duplicate `prepare` in package.json
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `package.json:34,42`

`"prepare": "husky install"` appears twice. Second overrides first in strict environments.

**Fix:** Remove duplicate.

---

### ⭐ [NICE TO HAVE] M-30: OpenAPI version mismatch (1.1.0 vs 1.4.0)
**Severity:** MEDIUM | **Source:** API/Integration  
**File:** `src/swaggerDocOptions.ts:9`, `package.json:2`

---

### ⭐ [NICE TO HAVE] M-31: Pre-open cache TTL coupled to cookie TTL (too short)
**Severity:** MEDIUM | **Source:** Performance  
**File:** `src/index.ts:92,454`

60-second TTL for pre-open data that is static outside 9:00-9:15 IST window.

**Fix:** Different TTLs: 5min during market hours, 1h outside.

---

### M-32: Silently swallowed enrichment errors
**Severity:** MEDIUM | **Source:** Performance  
**File:** `src/index.ts:493-507`

Both `Promise.all` branches in `fetchEquityDetailsEnrichment` use `.catch(() => undefined)`. Errors lost for ops teams.

**Fix:** Log at `warn` level before swallowing.

---

### M-33: Unnecessary in-memory sort of all 2000+ symbols
**Severity:** MEDIUM | **Source:** Performance  
**File:** `src/index.ts:448-449`

Sorting entire equity universe on every `getAllStockSymbols()` call.

**Fix:** Cache sorted list or pre-sort in constructor.

---

### M-34: Spinnable busy-loop in context optimization
**Severity:** MEDIUM | **Source:** Performance  
**File:** `src/mcp/context-summarizer.ts:337-343`

While loop decrementing 2 at a time may never converge for very long single messages.

---

### ⭐ [NICE TO HAVE] M-35: CLI-only dependencies in runtime bundle
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `package.json:86,73`

`ohlc`, `asciichart`, `chalk`, `ora`, `yargs` in `dependencies` not `devDependencies`. Installed even when using library programmatically.

**Fix:** Move to `peerDependencies` or make optional.

---

### ⭐ [NICE TO HAVE] M-36: `swaggerDocOptions.ts` points to `./build/routes.js`
**Severity:** MEDIUM | **Source:** Code Quality  
**File:** `src/swaggerDocOptions.ts:53`

Resolves from project root; if CWD differs or build artifacts missing, docs fail silently.

**Fix:** Use path from `__dirname`.

---

## LOW FINDINGS (27)

### ⭐ [NICE TO HAVE] L-1: Deprecated dependencies
**Severity:** LOW | **Source:** Security  
**File:** `package.json`

`moment` v2.29.4, `chalk` v4.1.2 (EOL), `cheerio` 1.0.0-rc.10, `@typescript-eslint` v5.57.0.

**Fix:** Update to latest stable versions.

---

### ⭐ [NICE TO HAVE] L-2: CLI input not validated for malicious symbols
**Severity:** LOW | **Source:** Security  
**Files:** `src/cli/index.ts:44-63`, `src/cli/api.ts`

No early validation of symbol input for shell metacharacters.

**Fix:** Add regex validation for valid NSE symbols.

---

### ⭐ [NICE TO HAVE] L-3: `noUnusedLocals`/`noUnusedParameters` commented out in tsconfig
**Severity:** LOW | **Source:** Security  
**File:** `tsconfig.json:41-42`

Allows dead code and unused parameters.

**Fix:** Enable both flags.

---

### ⭐ [NICE TO HAVE] L-4: Hardcoded default SSL certificate paths
**Severity:** LOW | **Source:** Security  
**File:** `src/server.ts:85-86`

Default paths point to localhost dev certs. Confusing error if HTTPS enabled without proper config.

**Fix:** Require explicit cert path when HTTPS enabled.

---

### ⭐ [NICE TO HAVE] L-5: GraphQL schema is stub — types don't match resolvers
**Severity:** LOW | **Source:** Code Quality  
**Files:** `src/equity.graphql`, `src/root.graphql`, `src/root.resolver.ts`, `src/stockIndex.graphql`

Typo: `EqutiyDetail` (missing 'i'). GraphQL `Query.equities` returns `string[]` but `[Equity]` expected. `Equity.symbol` resolver receives a `string` as parent. `Query.indices` returns mismatched field names.

**Fix:** Fix schema to match actual resolver output or vice versa.

---

### ⭐ [NICE TO HAVE] L-6: `EquityDetails` interface has non-optional fields that may be undefined
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/interface.ts:337-354`

Fields like `sddDetails`, `industryInfo`, `preOpenMarket` are required but filled with empty defaults in pre-open fallback.

**Fix:** Use `Partial<EquityDetails>` or mark as optional.

---

### ⭐ [NICE TO HAVE] L-7: Inconsistent naming conventions
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/interface.ts`

`IndexRecords` vs `indexRecords`, `PreOpenDetails` vs `preOpenDetails`, `grapthData` (typo: should be `graphData`).

---

### ⭐ [NICE TO HAVE] L-8: CLI typo — `deatils` instead of `details`
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/cli/api.ts:15,43,69`

User-facing typo in console output.

---

### ⭐ [NICE TO HAVE] L-9: `getPreOpenMarketCached` serves stale IEP during pre-open
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/index.ts:451-457`

60-second cache could serve stale Indicative Equilibrium Price during pre-open session (9:00-9:15 IST).

**Fix:** Reduce TTL or bypass cache during pre-open hours.

---

### ⭐ [NICE TO HAVE] L-10: `mcp-server-stdio.ts` fragile keep-alive pattern
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/mcp/server/mcp-server-stdio.ts:4-5`

Server runs via stdin/stdout but no explicit keep-alive mechanism documented.

---

### ⭐ [NICE TO HAVE] L-11: `handleMCPToolCall` — 15× duplicated validation pattern
**Severity:** LOW | **Source:** Code Quality  
**File:** `src/mcp/mcp-tools.ts:458-940`

`if (!args?.symbol || typeof args.symbol !== 'string')` repeated ~15 times.

**Fix:** Create `validateStringParam(args, name)` helper.

---

### ⭐ [NICE TO HAVE] L-12: No integration tests for REST/GraphQL/MCP/CLI
**Severity:** LOW | **Source:** API/Integration

Tests only cover `NseIndia` class directly. Routes, server, MCP tools, CLI, GraphQL resolvers untested.

---

### ⭐ [NICE TO HAVE] L-13: CLI MCP command lacks stdin signal handling
**Severity:** LOW | **Source:** API/Integration  
**File:** `src/cli/index.ts:26-33`

No handling for SIGHUP, SIGQUIT, or uncaughtException in MCP server mode.

---

### ⭐ [NICE TO HAVE] L-14: Demo script requires build before running
**Severity:** LOW | **Source:** API/Integration  
**File:** `demo/memory-example.js:8`

`require('../build/mcp/client/mcp-client.js')` — confusing error without build step.

---

### ⭐ [NICE TO HAVE] L-15-27: Additional minor issues
**Severity:** LOW

- CLI `historical` hardcodes 3-month range with no flags (Code Quality)
- F18: `/api/equity/:symbol` route conflicts with sub-routes (API/Integration)
- F19: No health check endpoint (API/Integration)
- F20: OpenAPI swagger version mismatch 1.1.0 vs 1.4.0 (API/Integration)
- F21: Typo in CLI messages `deatils` (API/Integration)
- F22: swaggerDocOptions points to `./build/routes.js` (API/Integration)
- F23: No health/readiness endpoint (API/Integration)
- F24: Token estimation uses rough `text.length/4` instead of tiktoken (API/Integration)
- F25: Demo uses absolute paths expecting build (API/Integration)
- F26: Missing JSDoc on key public methods (API/Integration)
- F27: No integration tests for any API layer (API/Integration)
- F28: No SIGHUP/uncaughtException handling in MCP CLI (API/Integration)

---

## TOP 10 PRIORITY ACTIONS

| # | Finding | Severity | Source | Effort | Impact |
|---|---------|----------|--------|--------|--------|
| 1 | C-2: ReDoS in GraphQL resolver | CRITICAL | Security | Low | Server DoS |
| 2 | C-1: No auth on MCP endpoints | CRITICAL | Security | Medium | OpenAI credit drain |
| 3 | C-3: Predictable session IDs | CRITICAL | Security | Low | Data breach |
| 4 | H-7: No request body limits | HIGH | Security | Trivial | Memory exhaustion |
| 5 | H-1: No rate limiting | HIGH | Security | Low | Abuse potential |
| 6 | C-13/C-14: Connection management | CRITICAL | Performance | Medium | NSE rate-limiting |
| 7 | C-15: Cache stampede | CRITICAL | Performance | Low | Traffic spikes |
| 8 | C-16: Zero backoff retries | CRITICAL | Performance | Low | Retry storms |
| 9 | C-6: Duplicate indicator code | CRITICAL | Code Quality | Medium | Maintainability |
| 10 | C-10: GraphQL 93% incomplete | CRITICAL | API/Integration | High | Feature gap |

---

## SCORING SUMMARY

```
Security:       26 findings (4 CRITICAL, 8 HIGH, 10 MEDIUM, 4 LOW)
Code Quality:   36 findings (5 CRITICAL, 9 HIGH, 12 MEDIUM, 10 LOW)
API/Integration:22 findings (2 CRITICAL, 2 HIGH, 6 MEDIUM, 12 LOW)
Performance:    24 findings (9 CRITICAL, 6 HIGH, 8 MEDIUM, 1 LOW)
─────────────────────────────────────────────────────────────
TOTAL:         108 findings (20 CRITICAL, 25 HIGH, 36 MEDIUM, 27 LOW)
```

*Report generated by 4 parallel audit agents (Security, Code Quality, API/Integration, Performance/Reliability) scanning the entire codebase.*
