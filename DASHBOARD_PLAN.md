# NSE Dashboard — Implementation Plan

**Goal:** A no-code-friendly web dashboard where users pick options from dropdowns and export data as CSV/JSON.
**Target user:** Someone who can click buttons and pick from lists — no coding required.

---

## GAPS IDENTIFIED & FIXED

| # | Gap | Risk | Fix |
|---|-----|------|-----|
| 1 | 2000+ symbols in plain `<select>` — unusable | User can't find anything | Replace with autocomplete text input that filters as you type |
| 2 | No server startup instructions | User opens HTML → blank page | Add "Prerequisites" section with `.env` + `npm start` |
| 3 | No error handling for NSE 403/502 | User sees broken page | Add `displayError()` banner + retry button per API call |
| 4 | Loading states only mentioned in Week 6 polish | 10-30s calls with no feedback | Add spinner per section on every fetch, from Phase 1 |
| 5 | Historical dates have no defaults | User must pick dates or get empty | Default to last 30 days; show date inputs with `max=today` |
| 6 | Response structure varies (array vs `{data:[]}` vs object) | Table shows "[object Object]" | Detect wrapper: unwrap `.data` if present; flatten nested fields |
| 7 | Cells with objects/arrays render as `[object Object]` | Useless table | `formatCell()`: JSON.stringify objects, join arrays with `;` |
| 8 | Stock tab needs 4+ API calls — no loading strategy | Sequential = 40s wait | Fire all 4 in parallel with `Promise.all`; show results as they arrive |
| 9 | Historical data chunking (66-day limit) missing | Wide date range = error | Chunking is server-side in `getEquityHistoricalData`; client just picks dates |
| 10 | API base URL hardcoded as relative `/api/...` | CORS fails on different origin | Add `API_BASE` config at top of file; default to empty string |
| 11 | First API call slow (10-15s session bootstrap) | User thinks it's broken | Call a warmup endpoint on load; show "Initializing session..." |
| 12 | No search within loaded data table | Can't find rows | Add a filter input above each table that hides non-matching rows |
| 13 | Large result sets with no pagination | 2000-row table freezes browser | Show first 100 rows + "Load next 100" button; or client-side pagination |
| 14 | Heterogeneous rows: `Object.keys(rows[0])` misses columns | Some columns missing | Union all keys across all rows: `[...new Set(rows.flatMap(Object.keys))]` |
| 15 | CSV breaks on commas/quotes inside cell values | Corrupted CSV | Use proper CSV escaping: wrap in quotes, escape inner quotes |
| 16 | Silent failure if API server is down | Dropdowns empty, no feedback | Check `/api/marketStatus` on load; show fatal error if unreachable |
| 17 | Tab data not cached — switching tabs re-fetches | Wasted API calls | Cache responses in a `Map<string, any>` keyed by URL |
| 18 | Market Overview fires 10+ sequential calls | Loads one at a time | Fire all in parallel with `Promise.allSettled`; show each as it arrives |
| 19 | No way to serve the HTML file | User can't open it correctly | Add "Running the Dashboard" section with serve options |
| 20 | No indication of API version | Future changes break dashboard | Note the server version this was built against |
| 21 | Cache never expires — market data goes stale | User sees outdated prices | Add TTL per endpoint type (intraday=30s, historical=5m, symbols list=1h) + "last fetched" timestamp + manual refresh button |
| 22 | `renderPaginated` uses inline `onclick` with string | Breaks in practice; scope issues | Use `addEventListener` and closure instead of inline HTML attributes |
| 23 | Technical tab URL builder missing indicator params | Indicator options silently ignored | Build full query string from all checkbox + input values |
| 24 | Autocomplete `input` event not debounced | If any network call added later, fires per keystroke | Add `debounce()` wrapper; mention it's only needed if network calls added |
| 25 | Duplicate empty "FILE STRUCTURE" heading exists | Confuses reader | Removed |

---

## TECH STACK

```
Recommended: Single HTML file + Vanilla JS (zero build tools)

Rationale:
- Zero setup: open in browser, it works
- Pre-populated dropdowns via REST API calls
- CSV/JSON export built into browsers (Blob + download link)
- No npm, no build, no server needed beyond the existing NSE API server

Alternative (if you prefer Python):
  Streamlit (streamlit.io) — 1 file, auto-generates dropdowns & tables
  But: requires Python + pip install, not as portable
```

---

## PREREQUISITES (Before Opening the Dashboard)

```bash
# 1. From the project root, copy env and start the API server
cp .env.example .env
# Edit .env if needed (CORS_ORIGINS=* for dev)
npm start
# Server runs at http://localhost:3000
```

### Serving the dashboard HTML:

| Method | Command | URL |
|--------|---------|-----|
| Built-in (put in `public/`) | `mkdir -p public && mv nse-dashboard.html public/index.html` | `http://localhost:3000` |
| Python | `python3 -m http.server 8080` | `http://localhost:8080` |
| npx | `npx serve .` | `http://localhost:3000` (may conflict) |

> **CORS note:** If serving from a different port than the API, set `CORS_ORIGINS=*` in `.env` and restart.

---

## PHASE 1 — Scaffold

**Goal:** One HTML file that loads, confirms the API is reachable, and shows data.

```
nse-dashboard.html     ← (single file, all-in-one)
```

### What it does:
1. Show "NSE India Data Explorer" title
2. **On load:** Check API health via `GET /api/marketStatus` (shows "Initializing session..." while NSE session bootstraps — first call takes 10-15s)
3. **If server down:** Show a fatal error banner: "Cannot reach API server at http://localhost:3000. Make sure `npm start` is running."
4. **If success:** Display the response in a table
5. "Export CSV" and "Export JSON" buttons
6. Spinner/loading text shown during every fetch

### Code patterns for all phases:

```javascript
// === Configuration (set once at top of file) ===
const API_BASE = ''  // Set to 'http://localhost:3000' if served from different origin

// === Loading state ===
function showLoading(containerId, msg = 'Loading...') {
  document.getElementById(containerId).innerHTML =
    `<div class="spinner"></div><p>${msg}</p>`
}

// === Error handling ===
function displayError(containerId, error, retryFn = null) {
  const msg = error?.message || String(error)
  let html = `<div class="error-banner">⚠️ ${escapeHtml(msg)}</div>`
  if (retryFn) html += `<button onclick="(${retryFn})()">Retry</button>`
  document.getElementById(containerId).innerHTML = html
}

// === Generic fetch with error handling ===
async function apiFetch(url) {
  const res = await fetch(`${API_BASE}${url}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? ': ' + text : ''}`)
  }
  return res.json()
}

// === Response normalizer (handles varied API shapes) ===
function normalizeRows(data) {
  // Some endpoints wrap in { data: [...] }
  let rows = data?.data ?? data
  // Ensure it's an array
  if (!Array.isArray(rows)) rows = [rows]
  return rows
}

// === Flatten nested fields for table display ===
function flattenRow(row, prefix = '') {
  const result = {}
  for (const [key, val] of Object.entries(row ?? {})) {
    const flatKey = prefix ? `${prefix}.${key}` : key
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenRow(val, flatKey))
    } else {
      result[flatKey] = val
    }
  }
  return result
}

// === Cell formatter (handles objects/arrays in cells) ===
function formatCell(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') {
    return Array.isArray(val) ? val.join('; ') : JSON.stringify(val)
  }
  return String(val)
}

// === CSV-safe escaping ===
function csvEscape(val) {
  const str = String(val ?? '')
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

// === Table renderer (handles any shape) ===
function renderTable(data, containerId) {
  const rows = normalizeRows(data)
  const container = document.getElementById(containerId)
  if (!rows.length) {
    container.innerHTML = '<p class="empty">No data returned</p>'
    return
  }

  // Flatten each row to handle nested objects
  const flatRows = rows.map(r => flattenRow(r))
  const headers = [...new Set(flatRows.flatMap(Object.keys))]

  let html = `<div class="table-wrap"><table><thead><tr>`
  html += headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')
  html += `</tr></thead><tbody>`
  html += flatRows.map(row => {
    return '<tr>' + headers.map(h => `<td>${escapeHtml(formatCell(row[h]))}</td>`).join('') + '</tr>'
  }).join('')
  html += `</tbody></table></div>`

  // Row count + pagination placeholder
  const totalRows = flatRows.length
  html += `<p class="row-count">${totalRows} row${totalRows !== 1 ? 's' : ''}</p>`

  container.innerHTML = html
  container.dataset.fullData = JSON.stringify(rows)  // Store raw data for export
}

// === Export functions ===
function exportCSV(containerId, filename) {
  const container = document.getElementById(containerId)
  const raw = JSON.parse(container.dataset.fullData || '[]')
  const rows = normalizeRows(raw).map(r => flattenRow(r))
  const headers = [...new Set(rows.flatMap(Object.keys))]
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ].join('\n')
  download(csv, filename + '.csv', 'text/csv;charset=utf-8')
}

function exportJSON(containerId, filename) {
  const container = document.getElementById(containerId)
  const raw = JSON.parse(container.dataset.fullData || '[]')
  download(JSON.stringify(raw, null, 2), filename + '.json', 'application/json')
}

function download(content, filename, mime) {
  const bom = '\uFEFF'  // BOM for Excel CSV compat
  const blob = new Blob([bom + content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// === Session warmup on page load ===
window.addEventListener('DOMContentLoaded', async () => {
  showLoading('main-output', 'Initializing NSE session (10-15s)...')
  try {
    const status = await apiFetch('/api/marketStatus')
    renderTable(status, 'main-output')
  } catch (err) {
    displayError('main-output', err,
      () => location.reload()  // Simple retry = reload
    )
  }
})
```

**Checkpoint:** Open the HTML → see "Initializing session..." → market status table appears → CSV/JSON export works.

---

## PHASE 2 — Category Tabs

**Goal:** Organize endpoints into clickable tabs matching API_ENDPOINTS.md.

```
Tab bar:  Market Overview | Stock Lookup | Indices | Options | Charts | Technical
```

### Tab structure:

| Tab | Endpoints Used | Inputs |
|-----|---------------|--------|
| **Market Overview** | marketStatus, marketTurnover, allIndices, tradingHolidays, merged reports | None — auto-loads all |
| **Stock Lookup** | /api/equity/:symbol, /api/equity/tradeInfo/:symbol, /api/equity/historical/:symbol | Symbol dropdown (pre-filled from /api/allSymbols) |
| **Indices** | /api/index/:indexSymbol, /api/gainersAndLosers/:indexSymbol, /api/mostActive/:indexSymbol | Index dropdown (pre-filled from /api/indexNames) |
| **Options** | /api/equity/options/:symbol, /api/index/options/:indexSymbol | Symbol or index dropdown |
| **Charts** | /api/charts/equity-historical-data | Symbol + chart type + interval dropdowns |
| **Technical** | /api/equity/technicalIndicators/:symbol | Symbol + period + indicator toggles |

### Implementation:
```html
<div class="tabs">
  <button class="tab active" data-tab="market">Market Overview</button>
  <button class="tab" data-tab="stock">Stock Lookup</button>
  <button class="tab" data-tab="indices">Indices</button>
  ...
</div>
<div id="market" class="tab-content active">...</div>
<div id="stock" class="tab-content">...</div>
...
```

Clicking a tab hides all content divs and shows the matching one.

---

## PHASE 3 — Dropdown Pre-Fill

**Goal:** Every input is populated automatically from the API — no manual typing.

### ⚠️ Critical: 2000+ symbols — don't use `<select>`

A plain dropdown with 2000 options is impossible to navigate. Use an **autocomplete text input** instead:

```
[Type symbol...       ] ← as user types, filter down
  ▼ suggestions (max 20 shown)
  IRCTC
  IRFC
  ITC
  ...
```

### Input types by field:

| Field | Widget Type | Source | Detail |
|-------|------------|--------|--------|
| Symbol | **Autocomplete text input** | `GET /api/allSymbols` → `string[]` | Filter client-side as user types; show max 20 matches |
| Index Name | **Dropdown `<select>`** | `GET /api/indexNames` → `[{key, index}]` | Only ~50 indices — plain select works fine |
| Chart Type | **Dropdown** | Static: `["Intraday (I)", "Daily (D)"]` | Hardcoded |
| Time Interval | **Dropdown** | Static: `["1", "5", "15", "30", "60"]` | Hardcoded |
| Indicator toggles | **Checkboxes + number inputs** | Static defaults | Each indicator has its own period field |
| Date range | **Two date inputs** | `min="2000-01-01" max="today"` | Default: last 30 days |

### Autocomplete input code pattern:

```html
<div class="autocomplete">
  <input type="text" id="symbol-input" placeholder="Type symbol..." autocomplete="off">
  <div id="symbol-suggestions" class="suggestions"></div>
</div>
```

```javascript
let allSymbols = []  // populated once on first use

async function loadSymbols() {
  if (allSymbols.length) return
  allSymbols = await apiFetch('/api/allSymbols')
}

function setupAutocomplete(inputId, suggestionsId, onSelect) {
  const input = document.getElementById(inputId)
  const container = document.getElementById(suggestionsId)

  // Debounce: only needed if input triggers network calls.
  // For client-side filter (2000 items in memory), no debounce needed —
  // filtering is instant. If you later add a network call here, wrap with:
  //   const debounced = debounce(fn, 200)
  input.addEventListener('input', () => {
    const val = input.value.toUpperCase()
    if (val.length < 1) { container.innerHTML = ''; return }

    const matches = allSymbols
      .filter(s => s.toUpperCase().includes(val))
      .slice(0, 20)  // Show max 20 suggestions

    container.innerHTML = matches.map(s =>
      `<div class="suggestion" data-value="${s}">${s}</div>`
    ).join('')

    container.querySelectorAll('.suggestion').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.dataset.value
        container.innerHTML = ''
        if (onSelect) onSelect(el.dataset.value)
      })
    })
  })

  // Hide suggestions on blur (with delay for click to register)
  input.addEventListener('blur', () =>
    setTimeout(() => container.innerHTML = '', 200)
  )
}

// Usage
async function initDropdowns() {
  showLoading('symbol-area', 'Loading symbols...')
  try {
    await loadSymbols()
    setupAutocomplete('symbol-input', 'symbol-suggestions')
  } catch (err) {
    displayError('symbol-area', err)
  }
}
```

### Plain dropdown (for indices — only ~50 items):
```javascript
async function populateSelect(selectId, endpoint, labelKey, valueKey) {
  const data = await apiFetch(endpoint)
  const select = document.getElementById(selectId)
  select.innerHTML = '<option value="">Select...</option>' +
    data.map(item =>
      `<option value="${item[valueKey || labelKey]}">${item[labelKey || valueKey]}</option>`
    ).join('')
}

// Usage
populateSelect('index-select', '/api/indexNames', 'index', 'key')

---

## PHASE 4 — Data Fetch + Display Table

**Goal:** Click "Get Data" → show results in a table (with search + pagination) → export buttons work.

### ⚠️ Key challenge: Multiple API calls per tab

Stock Lookup tab needs 4 calls: Details, Trade Info, Intraday, Historical.
Don't fire them sequentially — use **parallel loading** and show results as they arrive.

### Data flow:
```
User picks symbol → clicks "Get Data"
  → Show loading spinners in all sub-sections
  → Fire ALL API calls in parallel: Promise.allSettled([...])
  → Each call that succeeds: renderTable() into its section
  → Each call that fails: displayError() in its section
  → Cache responses in a Map (keyed by URL) so switching tabs doesn't re-fetch
```

### Caching layer (with TTL):

Different endpoints have different staleness tolerance. Market data expires in seconds; symbol lists can be cached for hours.

```javascript
const cache = new Map()

// TTL in milliseconds per URL pattern
const CACHE_TTL = {
  intraday: 30_000,    // 30s — prices change every tick
  marketStatus: 30_000,
  equityDetails: 60_000,  // 1min — quote data
  historical: 300_000,     // 5min — past prices don't change
  symbols: 3_600_000,      // 1h — symbol list is static
  indexNames: 3_600_000,
  default: 60_000          // fallback
}

function getTTL(url) {
  if (url.includes('/intraday')) return CACHE_TTL.intraday
  if (url.includes('/marketStatus')) return CACHE_TTL.marketStatus
  if (url.includes('/historical')) return CACHE_TTL.historical
  if (url.includes('/allSymbols')) return CACHE_TTL.symbols
  if (url.includes('/indexNames')) return CACHE_TTL.indexNames
  if (url.includes('/equity/') && !url.includes('/historical')) return CACHE_TTL.equityDetails
  return CACHE_TTL.default
}

async function fetchWithCache(url) {
  const cached = cache.get(url)
  if (cached && Date.now() < cached.expiry) return cached.data
  const data = await apiFetch(url)
  cache.set(url, { data, expiry: Date.now() + getTTL(url) })
  return data
}

// Manual refresh: delete single entry and re-fetch
function invalidateCache(url) { cache.delete(url) }

// Clear all cache (e.g., on "Refresh All" button)
function clearAllCache() { cache.clear() }
```

Show a "Last fetched: 30s ago" timestamp below each table using `data-fetched-at` attribute set during render. Add a small refresh icon in each section header. Single-section refresh calls `invalidateCache(url)` then re-fetches.

### Parallel loading for Stock tab:
```javascript
async function loadStockTab(symbol) {
  const sections = [
    { id: 'details-section',   url: `/api/equity/${symbol}` },
    { id: 'tradeinfo-section', url: `/api/equity/tradeInfo/${symbol}` },
    { id: 'intraday-section',  url: `/api/equity/intraday/${symbol}` },
  ]

  // Show all spinners
  sections.forEach(s => showLoading(s.id, 'Loading...'))

  // Fire all in parallel
  const results = await Promise.allSettled(
    sections.map(s => fetchWithCache(s.url).then(data => ({ id: s.id, data })))
  )

  // Render each as it resolved (already settled, so iterate)
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      renderTable(result.value.data, result.value.id)
    } else {
      displayError(result.status, result.reason)
    }
  })
}
```

### Search within loaded table:
```javascript
function addTableFilter(inputId, tableContainerId) {
  const input = document.getElementById(inputId)
  input.addEventListener('input', () => {
    const filter = input.value.toUpperCase()
    const table = document.querySelector(`#${tableContainerId} table`)
    if (!table) return
    const rows = table.querySelectorAll('tbody tr')
    rows.forEach(row => {
      const text = row.textContent.toUpperCase()
      row.style.display = text.includes(filter) ? '' : 'none'
    })
  })
}
// Usage: addTableFilter('stock-filter', 'details-section')
```

### Client-side pagination (for 2000+ row results):

Use closure and `addEventListener` — avoid inline `onclick` attributes (breaks in practice, no scope).

```javascript
function renderPaginated(data, containerId, pageSize = 100) {
  const rows = normalizeRows(data)
  const totalPages = Math.ceil(rows.length / pageSize)
  let currentPage = 1

  function renderPage() {
    const start = (currentPage - 1) * pageSize
    const pageRows = rows.slice(start, start + pageSize)
    const container = document.getElementById(containerId)

    // Render the table rows (reuse renderTable logic internally)
    const headers = [...new Set(pageRows.flatMap(r => Object.keys(flattenRow(r))))]
    let html = `<div class="table-wrap"><table><thead><tr>`
    html += headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')
    html += `</tr></thead><tbody>`
    html += pageRows.map(row => {
      const flat = flattenRow(row)
      return '<tr>' + headers.map(h => `<td>${escapeHtml(formatCell(flat[h]))}</td>`).join('') + '</tr>'
    }).join('')
    html += `</tbody></table></div>`

    // Pagination controls (use IDs, not onclick)
    html += `<div class="pagination" id="pagination-${containerId}">
      <button class="pg-prev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
      <span>Page ${currentPage} of ${totalPages} (${rows.length} rows)</span>
      <button class="pg-next" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
    </div>`

    container.innerHTML = html
    container.dataset.fullData = JSON.stringify(rows)

    // Attach event listeners (not inline onclick)
    container.querySelector('.pg-prev').addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderPage(); }
    })
    container.querySelector('.pg-next').addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; renderPage(); }
    })
  }

  renderPage()
}
```

---

## PHASE 5 — Indicators Tab (Advanced Options)

**Goal:** Technical indicators with optional parameter toggles.

### UI layout:
```
[ Symbol dropdown        ] [ Period: 200 ]
[ ✅ SMA     periods: 5,10,20,50,100,200 ]
[ ✅ EMA     periods: 5,10,20,50,100,200 ]
[ ✅ RSI     period: 14                   ]
[ ✅ Bollinger  period: 20  stdDev: 2     ]
[ ✅ MACD    fast: 12  slow: 26  signal: 9]
[ ✅ Stochastic  K: 14  D: 3              ]
[ ☐ Williams %R  period: 14               ]
[ ☐ ATR     period: 14                    ]
[ ☐ ADX     period: 14                    ]
[ ☐ OBV                                   ]
[ ☐ CCI     period: 20                    ]
[ ☐ MFI     period: 14                    ]
[ ☐ ROC     period: 10                    ]
[ ☐ Momentum  period: 10                  ]
[Show only latest values: ✅ Yes / ☐ No   ]

[ Get Indicators ]  [ Export CSV ]  [ Export JSON ]
```

Each checkbox toggles whether that indicator is included in the API call.

---

## PHASE 6 — Chart Tab (Candlestick)

**Goal:** Display a simple price chart (optional — requires a charting library).

### Options:
1. **Skip charts** — just show the OHLC data in a table (simplest)
2. **Canvas 2D** — draw your own candlesticks with `<canvas>` (no library needed, ~100 lines)
3. **Lightweight Charts** — `https://unpkg.com/lightweight-charts` (TradingView's lib, very clean, ~10 lines)

### Recommendation: Option 3 (Lightweight Charts) for production.

Canvas 2D is fine for a prototype but has pitfalls: sizing, zoom, crosshair, tooltips all need manual work. Lightweight Charts (`unpkg.com/lightweight-charts`) handles all of that in ~10 lines:

```javascript
import { createChart } from 'https://unpkg.com/lightweight-charts'
const chart = createChart(document.getElementById('chart'), { width: 800, height: 400 })
const candleSeries = chart.addCandlestickSeries()
candleSeries.setData(
  data.map(d => ({ time: d.timestamp / 1000, open: d.open, high: d.high, low: d.low, close: d.close }))
)
```

If going canvas, allocate a full day for crosshair + responsiveness + tooltips.

---

## FILE STRUCTURE

**Simplest approach (1 file):**
```
nse-dashboard.html   ← Everything: HTML + CSS + JS, ~500-800 lines
```

**Modular approach (if it gets too long):**
```
nse-dashboard/
├── index.html          ← Skeleton (tabs, containers)
├── style.css           ← All styling
├── app.js              ← Main logic, tab switching, routing
├── api.js              ← All fetch() calls to NSE API
├── table.js            ← renderTable(), exportCSV(), exportJSON()
└── chart.js            ← Canvas candlestick drawing (optional)
```

---

## UI MOCKUP (Text Layout)

```
┌──────────────────────────────────────────────────────┐
│  🏢 NSE India Data Explorer           [Export CSV]   │
│                                        [Export JSON]  │
├───────────┬──────────┬────────┬──────┬────────┬──────┤
│ Market    │ Stock    │ Indices│ Optns│ Charts │ Tech │
│ Overview  │ Lookup   │        │      │        │      │
├───────────┴──────────┴────────┴──────┴────────┴──────┤
│                                                       │
│  Stock Lookup Tab (example)                          │
│                                                       │
│  Symbol: [IRCTC____________▼]    [Get Data]          │
│                                                       │
│  ┌── Details ──┬── Trade Info ──┬── Intraday ──┐    │
│  │ Company     │ Day High/Low  │ Time   │Price│    │
│  │ Industry    │ Volume        │ 09:15  │4500 │    │
│  │ ISIN        │ Turnover      │ 09:30  │4510 │    │
│  │ Listing Date│               │ 09:45  │4505 │    │
│  └─────────────┴───────────────┴──────────────┘    │
│                                                       │
│  [Export CSV] [Export JSON]                           │
└──────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION ORDER

```
Week 1:  Phase 1 (scaffold) + Phase 2 (tabs)
          → Single HTML file with tabs switching, error handling, spinner
          → Health check on load with fatal error if server down
          → Market Overview tab with parallel loading + caching
          → Export CSV/JSON buttons working
          Checkpoint: Open HTML → see market data → export works

Week 2:  Phase 3 (dropdown pre-fill)
          → Autocomplete for symbols (2000+ items, filters as you type)
          → Plain dropdown for indices (~50 items)
          → All static dropdowns (chart type, interval, etc.)
          → Caching: all dropdown data loaded once and reused
          Checkpoint: Type "ITC" → suggestions appear → click → loads data

Week 3:  Phase 4 (table + export + pagination)
          → renderTable() handles nested objects, arrays, deep flatten
          → Parallel loading: Stock tab fires 4 calls at once
          → Client-side pagination: 100 rows per page
          → Search/filter input above each table
          → CSV with proper escaping (commas, quotes), BOM for Excel
          Checkpoint: Pick a symbol → 4 sections load in parallel → search rows → export

Week 4:  Phase 5 (indicators)
          → Technical tab with checkbox toggles + parameter inputs
          → Defaults pre-filled, user can customize
          → Indicator config → build query string → fetch → render
          Checkpoint: Toggle indicators → click "Get" → see values → export

Week 5:  Phase 6 (charting)
          → Candlestick chart on Charts tab via Canvas 2D
          → OHLC data from /api/charts/equity-historical-data
          → Volume bars below candles
          Checkpoint: Pick symbol + interval → see candlestick chart

Week 6:  Polish
          → Responsive layout for mobile
          → Dark/light mode toggle
          → 2000-row safety: pagination tested with large datasets
          → Error recovery: retry buttons on failed sections
          → CSS polish: clean, readable tables
```

---

## REFERENCE: Key REST URLs for Implementation

```javascript
// Pre-fill data sources
const SYMBOLS_URL     = '/api/allSymbols'              // → string[]
const INDEX_NAMES_URL = '/api/indexNames'              // → [{key, index, ...}]
const INDICES_URL     = '/api/allIndices'              // → [{key, index, last, ...}]

// Category endpoints — just append the selected value
const EQUITY_DETAILS  = symbol => `/api/equity/${symbol}`
const TRADE_INFO      = symbol => `/api/equity/tradeInfo/${symbol}`
const HISTORICAL      = (s, start, end) => `/api/equity/historical/${s}?dateStart=${start}&dateEnd=${end}`
const INDEX_STOCKS    = idx => `/api/index/${idx}`
const GAINERS_LOSERS  = idx => `/api/gainersAndLosers/${idx}`
const MOST_ACTIVE     = idx => `/api/mostActive/${idx}`
const EQUITY_OPTIONS  = sym => `/api/equity/options/${sym}`
const INDEX_OPTIONS   = idx => `/api/index/options/${idx}`
const CONTRACT_INFO   = idx => `/api/index/options/contract-info/${idx}`
const COMMODITY_OPT   = sym => `/api/commodity/options/${sym}`
const CHART_DATA      = (s, type, interval) => `/api/charts/equity-historical-data?symbol=${s}&chartType=${type}&timeInterval=${interval}`
const SYMBOL_INFO     = s => `/api/charts/symbol-info?symbol=${s}`

// Technical indicators — build full query string from form values
// Each indicator's params are only included if its checkbox is checked
const TECHNICAL = (symbol, opts) => {
  const params = new URLSearchParams()
  params.set('period', opts.period || 200)
  if (opts.smaEnabled)   params.set('smaPeriods', opts.smaPeriods || '5,10,20,50,100,200')
  if (opts.emaEnabled)   params.set('emaPeriods', opts.emaPeriods || '5,10,20,50,100,200')
  if (opts.rsiEnabled)   params.set('rsiPeriod', opts.rsiPeriod || 14)
  if (opts.bbEnabled)    { params.set('bbPeriod', opts.bbPeriod || 20); params.set('bbStdDev', opts.bbStdDev || 2) }
  if (opts.macdEnabled)  { params.set('macdFast', opts.macdFast || 12); params.set('macdSlow', opts.macdSlow || 26); params.set('macdSignal', opts.macdSignal || 9) }
  if (opts.stochEnabled) { params.set('stochK', opts.stochK || 14); params.set('stochD', opts.stochD || 3) }
  if (opts.williamsREnabled) params.set('williamsRPeriod', opts.williamsRPeriod || 14)
  if (opts.atrEnabled)   params.set('atrPeriod', opts.atrPeriod || 14)
  if (opts.adxEnabled)   params.set('adxPeriod', opts.adxPeriod || 14)
  if (opts.cciEnabled)   params.set('cciPeriod', opts.cciPeriod || 20)
  if (opts.mfiEnabled)   params.set('mfiPeriod', opts.mfiPeriod || 14)
  if (opts.rocEnabled)   params.set('rocPeriod', opts.rocPeriod || 10)
  if (opts.momentumEnabled) params.set('momentumPeriod', opts.momentumPeriod || 10)
  if (opts.obvEnabled)   { /* OBV has no period params — just the flag */ }
  if (opts.showOnlyLatest !== undefined) params.set('showOnlyLatest', opts.showOnlyLatest)
  return `/api/equity/technicalIndicators/${symbol}?${params.toString()}`
}
```

---

## RUNNING THE DASHBOARD

### Option A: Serve from the API server (simplest — no CORS issues)

```bash
mkdir -p public
cp nse-dashboard.html public/index.html
# Then start the server as usual:
cp .env.example .env
npm start
# Open http://localhost:3000
```

### Option B: Serve separately (needs CORS config)

```bash
# 1. Edit .env to allow your origin:
#    CORS_ORIGINS=http://localhost:8080
#    Or for dev: CORS_ORIGINS=*
# 2. Start the API server:
npm start

# 3. In another terminal, serve the dashboard:
npx serve .          # Opens on :3000 — change port if conflict
# Or:
python3 -m http.server 8080   # Opens on :8080
```

### Option C: Open directly (file:// — won't work)

Browsers block `fetch()` from `file://` URLs. You must use a local HTTP server.

### API_BASE config:

Set this at the top of `nse-dashboard.html`:

```javascript
// When served from the API server itself:
const API_BASE = ''  // Relative URLs work

// When served from a different origin:
const API_BASE = 'http://localhost:3000'  // Full URL to API server
```
