# Stock-NSE-India — Gap Analysis (Personal-Use Edition)

**Project:** `stock-nse-india` v1.4.0  
**Date:** 2026-05-28  
**Scope:** Full codebase audit by 4 parallel agents  
**Note:** Personal-use-safe security issues excluded. Nice-to-have items (missing features, docs, cosmetics) moved to original report.

---

## SEVERITY DISTRIBUTION

| Severity | Original | Excluded | Remaining |
|----------|----------|----------|-----------|
| CRITICAL | 20 | 4 | **16** |
| HIGH     | 25 | 12 | **13** |
| MEDIUM   | 36 | 21 | **15** |
| LOW      | 27 | 27 | **0** |
| **Total** | **108** | **64** | **44** |

---

## CRITICAL FINDINGS (16)

### C-1: ReDoS via user-supplied RegExp in GraphQL resolver
**Source:** Security  
**Files:** `src/root.resolver.ts:27-29`, `src/root.resolver.ts:56`, `src/inputs.graphql:3,13`

The `StringArrayFilter` and `ObjectFilter` GraphQL input types accept a user-supplied `regex` string passed directly to `new RegExp(regex)` without validation. Catastrophic backtracking payloads (e.g., `^(a+)+$`) cause Event Loop starvation — you can DoS yourself.

**Fix:** Add regex timeout wrapper or remove `regex` from schema.

---

### C-2: `NseIndia` is a 1124-line God class
**Source:** Code Quality  
**File:** `src/index.ts:89-1072`

Single Responsibility Principle violation. Handles session management, data fetching, caching, enrichment, charting, and technical indicator delegation. Makes maintenance and extension painful.

**Fix:** Extract `SessionManager`, `NseApiClient`, caching strategy objects, and `ChartingService`.

---

### C-3: Duplicated technical indicator rounding logic (~280 lines × 2)
**Source:** Code Quality  
**Files:** `src/routes.ts:814-957`, `src/mcp/mcp-tools.ts:675-855`

Two independently maintained copies of identical `roundTo2Decimals`, `roundArrayTo2Decimals`, and full indicator post-processing pipeline. Bug fixes must be applied twice.

**Fix:** Extract to shared `src/indicators-formatter.ts`.

---

### C-4: 38+ `any` type escapes in CLI layer
**Source:** Code Quality  
**File:** `src/cli/api.ts` (multiple lines), `src/cli/index.ts:44-75`

Entire CLI module uses `any` for all data structures. TypeScript offers zero protection. Runtime crashes on malformed API responses.

**Fix:** Add proper type annotations using `yargs.Arguments<>` and existing `interface.ts` types.

---

### C-5: `getData` returns `Promise<any>` — no type safety on primary data path
**Source:** Code Quality  
**File:** `src/index.ts:273`

The single most-called method has no return type linkage. Every consumer must cast or assert.

**Fix:** Use generics: `async getData<T>(url, domain): Promise<T>`.

---

### C-6: `istanbul ignore next` comments everywhere (40+ instances)
**Source:** Code Quality  
**Files:** `src/index.ts` (lines 719, 743, 785, 810-895), `src/helpers.ts` (lines 51-53, 76-96, 202-205)

Systematic exclusion of error handling, fallback paths, and edge cases from code coverage.

**Fix:** Remove all istanbul ignores; write tests for excluded branches.

---

### C-8: N+1 query problem in GraphQL `Equity.details`
**Source:** API/Integration  
**File:** `src/root.resolver.ts:76-84`

Querying `{ equities { details { priceInfo } } }` with 2000+ symbols triggers 2000+ HTTP requests to NSE.

**Fix:** Use DataLoader for batching.

---

### C-9: No HTTP keep-alive agent on axios clients
**Source:** Performance  
**File:** `src/index.ts:104-105`

Every outbound request performs a fresh TCP handshake + TLS negotiation, adding 60-150ms per call. Makes your own requests slower.

**Fix:** Configure `https.Agent` with `keepAlive: true`, `maxSockets: 10`.

---

### C-10: Busy-wait spinlock concurrency limiter
**Source:** Performance  
**File:** `src/index.ts:278-280`

`while (this.noOfConnections >= 5) { await sleep(500) }` — adds 0-500ms unnecessary latency to your own requests.

**Fix:** Replace with proper semaphore using `p-limit`.

---

### C-11: TOCTOU race condition on `noOfConnections`
**Source:** Performance  
**File:** `src/index.ts:278-281`

Between check and increment, multiple async functions can pass the guard, sending 2-3x intended connections to NSE and triggering 403s.

**Fix:** Use `p-limit` or eliminate manual counter.

---

### C-12: Cache stampede — no mutex on pre-open / capital-market cache
**Source:** Performance  
**Files:** `src/index.ts:451-457`, `src/index.ts:459-480`

50+ concurrent requests detect expiry and all fire identical API calls. Guarantees NSE rate limiting against you.

**Fix:** Promise-based dedup lock pattern.

---

### C-13: Fixed retries with zero backoff — retry storm risk
**Source:** Performance  
**File:** `src/index.ts:273-355`

All 3 retries fire back-to-back with no delay. Combined with cache stampede, 150 simultaneous requests.

**Fix:** Exponential backoff with jitter: `Math.min(1000 * Math.pow(2, retries) + Math.random() * 1000, 10000)`.

---

### C-14: CookieJar and axios instance accumulation
**Source:** Performance  
**File:** `src/index.ts:119-127`

Each session invalidation creates new CookieJar + axios client. Memory grows linearly with request volume.

**Fix:** Reuse same axios instance; clear cookie jar instead of recreating.

---

### C-15: Synchronous `fs.writeFileSync` on every memory write
**Source:** Performance  
**File:** `src/mcp/memory-manager.ts:413-427`

Called on EVERY user message. Blocks event loop for 50-200ms. Only matters if you use MCP memory features.

**Fix:** Async write with debouncing (2s interval).

---

### C-16: N+1 sequential HTTP dependency in charting flow
**Source:** Performance  
**File:** `src/index.ts:386-405`

Two sequential HTTP calls when token not provided. 600-2000ms minimum per stock. Batch queries (e.g., "all NIFTY 50 stocks") take minutes.

**Fix:** Pre-fetch and cache symbol info map.

---

### C-17: Unbounded in-memory session storage
**Source:** Performance  
**File:** `src/mcp/memory-manager.ts:70`

`Map<string, UserSession>` grows without disk eviction. Only matters if you use MCP memory heavily.

**Fix:** Session eviction to SQLite/Redis; reduce `maxConversationHistory`; don't store `originalMessages` in summarization records.

---

## HIGH FINDINGS (13)

### H-1: OpenAI API key leakage in error logs
**Source:** Security  
**Files:** `src/routes.ts:1625,1669,1730`

Errors logged with raw `error` object may contain API keys in stack traces.

**Fix:** Sanitize error objects before logging; use structured logging with redaction.

---

### H-2: NSE cookies stored as plaintext strings
**Source:** Security  
**File:** `src/index.ts:107-114`

Cookies stored as plaintext class properties, vulnerable to memory dumps.

**Fix:** Keep cookies in `CookieJar` only; add `toJSON()` excluding sensitive properties.

---

### H-4: Session data pushed to OpenAI without PII scrub
**Source:** Security  
**Files:** `src/mcp/client/mcp-client.ts:238-265`, `src/mcp/context-summarizer.ts:154-176`

Full conversation history including investment preferences sent to third-party AI. Relevant if you use MCP AI features.

**Fix:** Implement PII/anonymization filter; allow opt-out; display privacy notice.

---

### H-6: Retry ignores 502/503 — most common NSE transient errors
**Source:** Performance  
**File:** `src/index.ts:345-349`

502 and 503 treated as terminal failures. Your availability drops during NSE load.

**Fix:** Add 502/503 to retry condition with non-session-refresh continue.

---

### H-9: `memory-data.json` corruption risk from concurrent writes
**Source:** Performance  
**File:** `src/mcp/memory-manager.ts:413-427`

Multiple requests trigger simultaneous writes; second overwrites first. Only matters with concurrent MCP usage.

**Fix:** Atomic writes using temp file + rename.

---

### H-10: Race condition in `ensureNseSession` — double session bootstrap
**Source:** Performance  
**File:** `src/index.ts:202-225`

Multiple concurrent requests all fire NSE homepage bootstrapping. Burst of unnecessary requests at cache boundaries.

**Fix:** Promise dedup pattern.

---

### H-11: Race condition in `getOrCreateSession`
**Source:** Performance  
**File:** `src/mcp/memory-manager.ts:116-152`

Two concurrent requests with same sessionId: one overwrites the other. Data silently lost.

**Fix:** Check-then-act with `Map.has()` + `Map.set()`.

---

### H-12: Massive duplicated switch statements (REST routes vs MCP tools)
**Source:** Code Quality  
**Files:** `src/routes.ts` (50+ handlers), `src/mcp/mcp-tools.ts:458-940` (30+ switch cases)

Each feature requires changes in 3+ places.

**Fix:** Registry pattern where tools and routes auto-generated from single metadata array.

---

### H-13: ADX indicator is a placeholder (all zeros)
**Source:** Code Quality  
**File:** `src/helpers.ts:174`

`const adx = new Array(closes.length).fill(0)` — silently returns useless data.

**Fix:** Implement proper ADX or remove from the interface.

---

### H-18: `any` in `getTechnicalIndicators` options
**Source:** Code Quality  
**File:** `src/routes.ts:782`

Options built as empty `any` object with no type validation against actual parameter types.

**Fix:** Define proper `TechnicalIndicatorOptions` type.

---

### H-19: Tests cast class under test as `any`
**Source:** Code Quality  
**File:** `src/index.session.spec.ts:5`

Tests access private methods via `any` cast. If private methods rename, tests break silently.

**Fix:** Test through public API or extract session logic into testable class.

---

### H-20: `getIndexOptionChain` — 85-line istanbul-ignored block
**Source:** Code Quality  
**File:** `src/index.ts:810-895`

Entire auto-expiry-selection logic excluded from coverage. Critical logic untested.

**Fix:** Extract expiry-date-parsing into own function with tests.

---

### H-22: `getEquityChartHistoricalData` N+1 fallback path hits 502/503 without retry benefit
**Source:** API/Integration  
**File:** `src/index.ts:376-406`

The charting method falls back from primary API to charting API, but the fallback also lacks proper timeout/retry handling.

**Fix:** Apply same retry/backoff logic to charting fallback path.

---

## MEDIUM FINDINGS (15)

### M-2: Error messages expose internal NSE API URLs
**Source:** Security  
**File:** `src/index.ts:151-155`

Error messages include full URL path with query parameters (symbols).

**Fix:** Sanitize error messages before sending.

---

### M-3: GraphQL schema advertises ReDoS-vulnerable filters
**Source:** Security  
**Files:** `src/inputs.graphql`, `src/root.graphql`

`regex` field in GraphQL inputs visible via introspection.

**Fix:** Remove `regex` or replace with glob-style matching.

---

### M-4: No API key validation before OpenAI calls
**Source:** Security  
**Files:** `src/mcp/client/mcp-client.ts:86-93`, `src/routes.ts:1588-1592`

Only checks existence. No format/validity check. Misconfigured key fails at first call.

**Fix:** Validate key format; lightweight API call at boot.

---

### M-5: Session timeout not enforced for memory persistence
**Source:** Security  
**File:** `src/mcp/memory-manager.ts:398-408`

Expired sessions accumulate in `memory-data.json` indefinitely.

**Fix:** Periodic timer for cleanup; filter expired on load.

---

### M-6: SSL key/cert path traversal risk
**Source:** Security  
**File:** `src/server.ts:85-86`

Environment variables for SSL paths can point to arbitrary files.

**Fix:** Validate paths are within allowed directory.

---

### M-7: Potential infinite loop in context optimization
**Source:** Security  
**File:** `src/mcp/context-summarizer.ts:337-343`

While loop may never exit if token count exceeds target at minimum messages.

**Fix:** Add exit guard when `recentMessageCount < 2`.

---

### M-9: `MCPClient` singleton anti-pattern
**Source:** Code Quality  
**File:** `src/mcp/client/mcp-client.ts:958-969`

Global singleton shared across requests. `enableDebugLogging` can race.

**Fix:** Per-request instantiation or clone-safe configuration.

---

### M-10: `getConfig()` returns mutable references
**Source:** Code Quality  
**Files:** `src/mcp/mcp-client.ts:900-902`, `src/mcp/context-summarizer.ts:445-447`

Shallow copies; nested objects still shared references.

**Fix:** Deep-clone or make fully immutable.

---

### M-16: Error handling inconsistency — MCP routes vs REST routes
**Source:** Code Quality  
**File:** `src/routes.ts`

REST uses `sendRouteError` (centralized); MCP uses ad-hoc `console.error`.

**Fix:** Unify under `sendRouteError` or middleware.

---

### M-17: `getIndexIntradayData` returns raw `any` shape
**Source:** Code Quality  
**File:** `src/index.ts:786`

Return type is `Promise<IntradayData>` but fallback is not validated.

**Fix:** Validate with `isIntradayDataShape` or map explicitly.

---

### M-18: `resolveCapitalMarketType` silently swallows errors
**Source:** Code Quality  
**File:** `src/index.ts:477-479`

Silently returns `'NM'` on error, masking config issues.

**Fix:** Log warning before default.

---

### M-24: Route conflict — `/api/equity/:symbol` catch-all
**Source:** API/Integration  
**File:** `src/routes.ts:353`

If `:symbol` matches "series", wrong handler fires.

**Fix:** Reorder routes or use path prefix.

---

### M-29: Silently swallowed enrichment errors
**Source:** Performance  
**File:** `src/index.ts:493-507`

Both `Promise.all` branches in enrichment use `.catch(() => undefined)`. Ops visibility lost.

**Fix:** Log at `warn` level before swallowing.

---

### M-30: Unnecessary in-memory sort of all 2000+ symbols
**Source:** Performance  
**File:** `src/index.ts:448-449`

Sorts entire equity universe on every `getAllStockSymbols()` call.

**Fix:** Cache sorted list.

---

### M-34: Spinnable busy-loop in context optimization
**Source:** Performance  
**File:** `src/mcp/context-summarizer.ts:337-343`

While loop may not converge for very long single messages.

**Fix:** Add convergence guard.

---

## TOP 8 PRIORITY ACTIONS (Personal Use)

| # | Finding | Severity | Why It Matters For You | Effort |
|---|---------|----------|----------------------|--------|
| 1 | C-9: No keep-alive agent | CRITICAL | Every request 60-150ms slower | Low |
| 2 | C-10: Busy-wait spinlock | CRITICAL | 0-500ms added latency to your requests | Medium |
| 3 | C-12: Cache stampede | CRITICAL | You hit NSE 403s every 60s | Low |
| 4 | C-13: Zero backoff retries | CRITICAL | Retry storms make things worse | Low |
| 5 | C-16: N+1 charting | CRITICAL | Batch queries take minutes | Medium |
| 6 | C-1: ReDoS (even for yourself) | CRITICAL | Accidental regex DoS | Low |
| 7 | C-14: CookieJar leak | CRITICAL | Memory grows over time | Low |
| 8 | H-6: Retry ignores 502/503 | HIGH | Your requests fail unnecessarily during NSE load | Low |

---

## SCORING SUMMARY

```
Remaining after exclusions: 44 findings (real bugs/defects only)
CRITICAL: 16 | HIGH: 13 | MEDIUM: 15 | LOW: 0
```

*Excluded (personal-use-safe):* 8 items (auth, rate limiting, CORS, headers, introspection, session IDs, disk plaintext).  
*Removed (functionality-limiting):* 5 items (body size limit, axios timeout, Promise.allSettled, circuit breaker, HTTPS default).  
*Removed (nice-to-have):* 51 items (missing features, docs gaps, cosmetics, housekeeping, design preferences).  
**Total excluded: 64 items**
