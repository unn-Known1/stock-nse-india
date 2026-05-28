// ═══════════════════════════════════════════════════════════
// NSE India Data Explorer — App Logic
// ═══════════════════════════════════════════════════════════

// ── Configuration (port auto-detection) ───────────────────
// Probes common ports at startup to find the API server.
// Dashboard works with: same origin, localhost:3000-3003, or manual API_BASE override.
const PROBE_PORTS = ['', '3000', '3001', '3002', '3003']
let API_BASE = ''

const urlParams = new URLSearchParams(window.location.search)
const apiBaseOverride = urlParams.get('api_base')
if (apiBaseOverride) API_BASE = apiBaseOverride

let searchController = null
const intervalIds = []

async function findApiBase() {
  if (API_BASE) return true
  // If served from same origin as API, relative URLs work
  const probeUrls = PROBE_PORTS.map(p => {
    if (!p) return { port: p, url: window.location.origin }
    return { port: p, url: `http://localhost:${p}` }
  })

  for (const { port, url } of probeUrls) {
    try {
      const res = await fetch(`${url}/api/marketStatus`, {
        signal: AbortSignal.timeout(3000)
      })
      if (res.ok) {
        API_BASE = port ? url : ''
        // API server found
        return true
      }
    } catch {
      // port not responding, try next
    }
  }

  // Fallback: assume same origin
  API_BASE = ''
  // using same origin as fallback
  return false
}

// ── Cache with TTL ─────────────────────────────────────────
const cache = new Map()

function getTTL(url) {
  if (url.includes('/intraday') || url.includes('/marketStatus') || url.includes('/marketTurnover')) return 30_000
  if (url.includes('/historical')) return 300_000
  if (url.includes('/allSymbols') || url.includes('/indexNames') || url.includes('/allIndices')) return 3_600_000
  if (url.includes('/equity/') && !url.includes('/historical')) return 60_000
  return 60_000
}

function cacheGet(url) {
  const entry = cache.get(url)
  if (entry && Date.now() < entry.expiry) return entry.data
  if (entry) cache.delete(url)
  return null
}

function cacheSet(url, data) {
  cache.set(url, { data, expiry: Date.now() + getTTL(url) })
  if (cache.size > 500) {
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
}

function invalidateCache(url) { cache.delete(url) }
function clearAllCache() { cache.clear(); mcpToolsCache = null; mcpToolsCacheTimestamp = null }

// ── API Fetch ──────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const isGet = !options.method || options.method === 'GET'
  if (isGet) {
    const cached = cacheGet(url)
    if (cached) return cached
  }

  let lastError
  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${url}`, options)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`${res.status}${text ? ': ' + text.replace(/\[NSE API\]/g, 'NSE') : ''}`)
      }
      const data = await res.json()
      if (isGet) cacheSet(url, data)
      return data
    } catch (err) {
      if (isGet && err instanceof TypeError && attempt < maxRetries) {
        lastError = err
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      throw err
    }
  }
  throw lastError || new Error('Request failed')
}

// ── Data Normalizers ───────────────────────────────────────
function normalizeRows(data) {
  let rows = data && typeof data === 'object' && 'data' in data ? data.data : data
  if (!Array.isArray(rows)) rows = rows != null ? [rows] : []
  return rows
}

function flattenRow(row, prefix = '') {
  const result = {}
  for (const [key, val] of Object.entries(row || {})) {
    const flatKey = prefix ? `${prefix}.${key}` : key
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      Object.assign(result, flattenRow(val, flatKey))
    } else {
      result[flatKey] = val
    }
  }
  return result
}

function formatCell(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return Array.isArray(val) ? val.join('; ') : JSON.stringify(val)
  return String(val)
}

function csvEscape(val) {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = String(s ?? '')
  return d.innerHTML
}

// ── Loading / Error States ─────────────────────────────────
function showLoading(containerId, msg = 'Loading...') {
  const el = document.getElementById(containerId)
  if (el) el.innerHTML = `<div class="loading-msg"><span class="spinner"></span>${escapeHtml(msg)}</div>`
}

function showEmpty(containerId, msg = 'No data returned') {
  const el = document.getElementById(containerId)
  if (el) el.innerHTML = `<div class="empty-msg">${escapeHtml(msg)}</div>`
}

function showError(containerId, error, retryFn = null) {
  const el = document.getElementById(containerId)
  if (!el) return
  const msg = error?.message || String(error)
  let html = `<div class="error-banner">⚠️ ${escapeHtml(msg)}`
  if (retryFn) html += `<button class="btn btn-sm" id="retry-${containerId}">Retry</button>`
  html += '</div>'
  el.innerHTML = html
  if (retryFn) {
    document.getElementById(`retry-${containerId}`)?.addEventListener('click', retryFn)
  }
}

// ── Table Renderer ─────────────────────────────────────────
function renderTable(data, containerId, pageSize = 100) {
  const container = document.getElementById(containerId)
  const rawRows = normalizeRows(data)

  if (!rawRows.length) {
    container.innerHTML = `<div class="empty-msg">No data returned</div>`
    return
  }

  const flatRows = rawRows.map(r => flattenRow(r))
  const headers = [...new Set(flatRows.flatMap(Object.keys))]
  const totalPages = Math.ceil(flatRows.length / pageSize)
  let currentPage = 1

  function renderPage() {
    const start = (currentPage - 1) * pageSize
    const page = flatRows.slice(start, start + pageSize)

    let html = `<div class="table-wrap"><table><thead><tr>`
    html += headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')
    html += `</tr></thead><tbody>`
    html += page.map(row =>
      '<tr>' + headers.map(h => `<td>${escapeHtml(formatCell(row[h]))}</td>`).join('') + '</tr>'
    ).join('')
    html += `</tbody></table></div>`

    html += `<p class="row-count">${flatRows.length} row${flatRows.length !== 1 ? 's' : ''}`
    if (totalPages > 1) html += ` — Page ${currentPage} of ${totalPages}`
    html += '</p>'

    if (totalPages > 1) {
      html += `<div class="pagination" data-pg="${containerId}">
        <button class="btn btn-sm pg-prev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
        <button class="btn btn-sm pg-next" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
      </div>`
    }

    container.innerHTML = html
    container.dataset.fullData = JSON.stringify(rawRows)

    const pgDiv = container.querySelector(`[data-pg="${containerId}"]`)
    if (pgDiv) {
      pgDiv.querySelector('.pg-prev')?.addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderPage(); }
      })
      pgDiv.querySelector('.pg-next')?.addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; renderPage(); }
      })
    }
  }

  renderPage()
  return rawRows
}

// ── Table Filter (Search within table) ─────────────────────
function setupTableFilter(inputId, tableContainerId) {
  const input = document.getElementById(inputId)
  if (!input) return
  input.addEventListener('input', () => {
    const filter = input.value.toUpperCase()
    const table = document.querySelector(`#${tableContainerId} table`)
    if (!table) return
    const rows = table.querySelectorAll('tbody tr')
    rows.forEach(row => {
      row.style.display = row.textContent.toUpperCase().includes(filter) ? '' : 'none'
    })
  })
}

// ── Exports ─────────────────────────────────────────────────
function exportCSV(containerId, filename) {
  const container = document.getElementById(containerId)
  const raw = JSON.parse(container.dataset.fullData || '[]')
  const rows = normalizeRows(raw).map(r => flattenRow(r))
  const headers = [...new Set(rows.flatMap(Object.keys))]
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  ].join('\n')
  download('\uFEFF' + csv, `${filename}.csv`, 'text/csv;charset=utf-8')
}

function exportJSON(containerId, filename) {
  const container = document.getElementById(containerId)
  download(container.dataset.fullData || '{}', `${filename}.json`, 'application/json')
}

function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Autocomplete ────────────────────────────────────────────
let allSymbolsCache = []

async function loadSymbols() {
  if (allSymbolsCache.length) return
  allSymbolsCache = await apiFetch('/api/allSymbols')
}

function setupAutocomplete(inputId, suggestionsId, onSelect) {
  const input = document.getElementById(inputId)
  const container = document.getElementById(suggestionsId)
  if (!input || !container) return

  let highlightedIdx = -1

  input.addEventListener('input', () => {
    const val = input.value.toUpperCase()
    if (val.length < 1) { container.innerHTML = ''; highlightedIdx = -1; return }

    const matches = allSymbolsCache.filter(s => s.toUpperCase().includes(val)).slice(0, 20)
    highlightedIdx = -1
    container.innerHTML = matches.map((s, i) =>
      `<div class="suggestion" data-idx="${i}" data-value="${escapeHtml(s)}">${escapeHtml(s)}</div>`
    ).join('')

    container.querySelectorAll('.suggestion').forEach(el => {
      el.addEventListener('click', () => {
        input.value = el.dataset.value
        container.innerHTML = ''
        highlightedIdx = -1
        if (onSelect) onSelect(el.dataset.value)
      })
    })
  })

  input.addEventListener('keydown', (e) => {
    const items = container.querySelectorAll('.suggestion')
    if (!items.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightedIdx = Math.max(highlightedIdx - 1, 0)
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault()
      items[highlightedIdx]?.click()
      return
    } else return

    items.forEach((el, i) => el.classList.toggle('highlighted', i === highlightedIdx))
    items[highlightedIdx]?.scrollIntoView({ block: 'nearest' })
  })

  input.addEventListener('blur', () => setTimeout(() => { container.innerHTML = ''; highlightedIdx = -1 }, 200))
}

// ── Tab System ──────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
      btn.classList.add('active')
      const tab = document.getElementById(btn.dataset.tab)
      if (tab) tab.classList.add('active')
    })
  })
}

// ── Market Overview Tab ─────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────
function colorClass(val) {
  if (val === null || val === undefined || val === '' || val === 0) return ''
  const n = Number(val)
  if (isNaN(n)) return ''
  return n > 0 ? 'up' : n < 0 ? 'down' : ''
}

function formatNum(val) {
  if (val === null || val === undefined || val === '') return '—'
  const n = Number(val)
  if (isNaN(n)) return val
  if (Math.abs(n) >= 10000000) return (n / 10000000).toFixed(2) + 'Cr'
  if (Math.abs(n) >= 100000) return (n / 100000).toFixed(2) + 'L'
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function arrow(val) {
  if (!val || val === 0 || val === '0') return ''
  const n = Number(val)
  if (isNaN(n) || n === 0) return ''
  return n > 0 ? '▲' : '▼'
}

function lastUpdated() {
  return new Date().toLocaleTimeString()
}

let moAutoRefreshTimer = null

function initMarketTab() {
  document.getElementById('mo-refresh')?.addEventListener('click', () => {
    invalidateCache('/api/marketStatus')
    invalidateCache('/api/allIndices')
    invalidateCache('/api/holidays?type=trading')
    invalidateCache('/api/marketTurnover')
    loadMarketData()
  })

  document.getElementById('mo-auto-refresh')?.addEventListener('change', (e) => {
    if (moAutoRefreshTimer) { clearInterval(moAutoRefreshTimer); moAutoRefreshTimer = null }
    if (e.target.checked) {
      moAutoRefreshTimer = setInterval(() => {
        invalidateCache('/api/marketStatus')
        invalidateCache('/api/allIndices')
        invalidateCache('/api/holidays?type=trading')
        invalidateCache('/api/marketTurnover')
        loadMarketData()
      }, 30000)
      intervalIds.push(moAutoRefreshTimer)
    }
  })

  document.getElementById('mo-indices-filter')?.addEventListener('input', () => {
    filterIndicesTable()
  })

  loadMarketData()
}

function statusMsg(msg) {
  const el = document.getElementById('mo-status-msg')
  if (el) el.textContent = msg
}

async function loadMarketData() {
  statusMsg('Loading...')

  const [statusRes, indicesRes, holidaysRes, turnoverRes] = await Promise.allSettled([
    apiFetch('/api/marketStatus').then(d => ({ id: 'status', data: d })),
    apiFetch('/api/allIndices').then(d => ({ id: 'indices', data: d })),
    apiFetch('/api/holidays?type=trading').then(d => ({ id: 'holidays', data: d })),
    apiFetch('/api/marketTurnover').then(d => ({ id: 'turnover', data: d })),
  ])

  // 1. Pulse bar from marketStatus
  if (statusRes.status === 'fulfilled') {
    renderPulseBar(statusRes.value.data)
  }

  // 2. Key indices + all indices from allIndices
  if (indicesRes.status === 'fulfilled') {
    renderKeyIndices(indicesRes.value.data)
    renderAllIndices(indicesRes.value.data)
  } else {
    document.getElementById('mo-all-indices').innerHTML = `<div class="empty-msg">Failed to load indices</div>`
  }

  // 3. Holidays
  if (holidaysRes.status === 'fulfilled') {
    renderHolidays(holidaysRes.value.data)
  } else {
    document.getElementById('mo-holidays-t').innerHTML = `<div class="empty-msg">Failed to load holidays</div>`
  }

  // 4. Turnover
  if (turnoverRes.status === 'fulfilled') {
    renderTurnover(turnoverRes.value.data)
  } else {
    document.getElementById('mo-turnover').innerHTML = `<div class="empty-msg">No turnover data</div>`
  }

  document.getElementById('mo-pulse-time').textContent = lastUpdated()
  statusMsg(`Updated ${lastUpdated()}`)
}

// ── Pulse Bar ───────────────────────────────────────────────
function renderPulseBar(data) {
  const states = data?.marketState || []
  const capital = states.find(s => s.market === 'Capital Market') || {}
  const niftyVal = capital.last
  const niftyChg = capital.variation
  const niftyPct = capital.percentChange

  // Market status
  const statusEl = document.getElementById('mo-pulse-status')
  const isOpen = capital.marketStatus === 'Open'
  statusEl.innerHTML = `<span class="status-badge ${isOpen ? 'open' : 'closed'}">${isOpen ? '● Open' : '● Closed'}</span>`

  // Nifty 50
  const niftyColor = colorClass(niftyChg)
  document.getElementById('mo-pulse-nifty').innerHTML =
    `<span class="value-lg ${niftyColor}">${formatNum(niftyVal)}</span> ` +
    `<span class="change-sm ${niftyColor}">${arrow(niftyChg)} ${formatNum(niftyChg)} (${formatNum(niftyPct)}%)</span>`

  // Advance/Decline - find Nifty 50 in allIndices data or from capital market
  // We'll extract from allIndices data later; for now show market status message
  document.getElementById('mo-pulse-ad').textContent = capital.marketStatusMessage || '—'
}

// ── Key Indices ─────────────────────────────────────────────
const KEY_INDEX_NAMES = ['NIFTY 50', 'NIFTY BANK', 'NIFTY NEXT 50', 'NIFTY IT', 'NIFTY PHARMA', 'INDIA VIX']

function renderKeyIndices(data) {
  const indices = data?.data || []
  const container = document.getElementById('mo-key-indices')
  if (!indices.length) { container.innerHTML = '<div class="empty-msg">No data</div>'; return }

  // Update pulse AD/VIX from full index data
  const niftyIdx = indices.find(i => i.index === 'NIFTY 50')
  const vixIdx = indices.find(i => i.index === 'INDIA VIX')
  if (niftyIdx) {
    document.getElementById('mo-pulse-ad').innerHTML =
      `<span class="up">${niftyIdx.advances || 0}</span> / <span class="down">${niftyIdx.declines || 0}</span> / ${niftyIdx.unchanged || 0}`
  }
  if (vixIdx) {
    const vixColor = colorClass(vixIdx.variation)
    document.getElementById('mo-pulse-vix').innerHTML =
      `<span class="${vixColor}">${formatNum(vixIdx.last)}</span>`
  }

  // Filter to key indices
  const keyItems = indices.filter(i => KEY_INDEX_NAMES.includes(i.index))
  // If key indices include VIX, show all; otherwise add top ones
  const topIndices = indices.filter(i => !KEY_INDEX_NAMES.includes(i.index)).slice(0, 10)

  const allKey = [...keyItems, ...topIndices].slice(0, 12)

  container.innerHTML = allKey.map(i => {
    const chgColor = colorClass(i.variation)
    return `<div class="ki-card">
      <div class="ki-name">${escapeHtml(i.index)}</div>
      <div class="ki-value ${chgColor}">${formatNum(i.last)}</div>
      <div class="ki-change ${chgColor}">${arrow(i.variation)} ${formatNum(i.variation)} (${formatNum(i.percentChange)}%)</div>
      <div class="ki-meta">O:${formatNum(i.open)} H:${formatNum(i.high)} L:${formatNum(i.low)}</div>
    </div>`
  }).join('')
}

// ── All Indices Table ───────────────────────────────────────
function renderAllIndices(data) {
  // Store raw data and render table
  const container = document.getElementById('mo-all-indices')
  const indices = data?.data || []
  if (!indices.length) { container.innerHTML = '<div class="empty-msg">No data</div>'; return }

  container.dataset.fullData = JSON.stringify(indices)

  const headers = ['Index', 'Last', 'Chg', '%Chg', 'Open', 'High', 'Low', 'Prev Close', 'Adv/Dec', 'Yr High', 'Yr Low']
  const keys = ['index', 'last', 'variation', 'percentChange', 'open', 'high', 'low', 'previousClose', null, 'yearHigh', 'yearLow']

  let html = `<div class="table-wrap"><table id="mo-indices-table"><thead><tr>`
  html += headers.map(h => `<th>${h}</th>`).join('')
  html += `</tr></thead><tbody>`
  html += indices.map(i => {
    const chgColor = colorClass(i.variation)
    const ad = i.advances !== undefined && i.declines !== undefined
      ? `<span class="up">${i.advances}</span>/<span class="down">${i.declines}</span>${i.unchanged ? '/'+i.unchanged : ''}`
      : '—'
    return `<tr>
      <td><strong>${escapeHtml(i.index)}</strong></td>
      <td class="num ${chgColor}">${formatNum(i.last)}</td>
      <td class="num ${chgColor}">${arrow(i.variation)}${formatNum(i.variation)}</td>
      <td class="num ${chgColor}">${formatNum(i.percentChange)}%</td>
      <td class="num">${formatNum(i.open)}</td>
      <td class="num">${formatNum(i.high)}</td>
      <td class="num">${formatNum(i.low)}</td>
      <td class="num">${formatNum(i.previousClose)}</td>
      <td class="num">${ad}</td>
      <td class="num">${formatNum(i.yearHigh)}</td>
      <td class="num">${formatNum(i.yearLow)}</td>
    </tr>`
  }).join('')
  html += `</tbody></table></div>`
  html += `<p class="row-count">${indices.length} indices</p>`

  container.innerHTML = html
}

function filterIndicesTable() {
  const query = (document.getElementById('mo-indices-filter')?.value || '').toUpperCase()
  const table = document.querySelector('#mo-all-indices table')
  if (!table) return
  const rows = table.querySelectorAll('tbody tr')
  rows.forEach(row => {
    row.style.display = row.textContent.toUpperCase().includes(query) ? '' : 'none'
  })
}

// ── Holidays ────────────────────────────────────────────────
function renderHolidays(data) {
  const container = document.getElementById('mo-holidays-t')
  const holidays = data?.CBM || []
  if (!holidays.length) { container.innerHTML = '<div class="empty-msg">No holidays</div>'; return }

  // Get upcoming holidays
  const now = new Date()
  const parsed = holidays.map(h => {
    const parts = h.tradingDate.split('-')
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}
    const d = new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]))
    return { ...h, dateObj: d, isPast: d < now }
  })
  parsed.sort((a, b) => a.dateObj - b.dateObj)

  const upcoming = parsed.filter(h => !h.isPast).slice(0, 10)
  const past = parsed.filter(h => h.isPast).slice(-5)

  let html = ''
  if (upcoming.length) {
    html += `<div class="holiday-section"><div class="holiday-section-title">Upcoming (${upcoming.length})</div>`
    html += upcoming.map(h => {
      const days = Math.ceil((h.dateObj - now) / (1000*60*60*24))
      return `<div class="holiday-row">
        <span class="holiday-date">${escapeHtml(h.tradingDate)}</span>
        <span class="holiday-weekday">${escapeHtml(h.weekDay)}</span>
        <span class="holiday-desc">${escapeHtml(h.description)}</span>
        <span class="holiday-days">${days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days + 'd'}</span>
      </div>`
    }).join('')
    html += `</div>`
  }

  let tableHtml = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Day</th><th>Description</th></tr></thead><tbody>`
  tableHtml += parsed.map(h =>
    `<tr class="${h.isPast ? 'holiday-past' : ''}">
      <td>${escapeHtml(h.tradingDate)}</td>
      <td>${escapeHtml(h.weekDay)}</td>
      <td>${escapeHtml(h.description)}</td>
    </tr>`
  ).join('')
  tableHtml += `</tbody></table></div>`
  tableHtml += `<p class="row-count">${holidays.length} holidays</p>`

  container.innerHTML = html + tableHtml
}

// ── Turnover ────────────────────────────────────────────────
function renderTurnover(data) {
  const container = document.getElementById('mo-turnover')
  if (!data || data === '') {
    container.innerHTML = '<div class="empty-msg">No turnover data available</div>'
    return
  }
  renderTable(data, 'mo-turnover')
}

// ── Stock Lookup Tab ────────────────────────────────────────
const RECENT_STOCKS = []

function initStockTab() {
  setupAutocomplete('stock-symbol', 'stock-suggestions', (symbol) => {
    loadStockData(symbol)
  })

  document.getElementById('stock-go')?.addEventListener('click', () => {
    const symbol = document.getElementById('stock-symbol')?.value.trim().toUpperCase()
    if (symbol) loadStockData(symbol)
  })

  document.getElementById('stock-symbol')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('stock-go')?.click()
  })
}

function addRecentStock(symbol) {
  if (RECENT_STOCKS.includes(symbol)) {
    const idx = RECENT_STOCKS.indexOf(symbol)
    RECENT_STOCKS.splice(idx, 1)
  }
  RECENT_STOCKS.unshift(symbol)
  if (RECENT_STOCKS.length > 8) RECENT_STOCKS.pop()
  renderRecentStocks()
}

function renderRecentStocks() {
  const container = document.getElementById('stock-recents')
  if (!container || !RECENT_STOCKS.length) { if (container) container.style.display = 'none'; return }
  container.style.display = 'flex'
  container.innerHTML = '<span class="recents-label">Recent:</span>' +
    RECENT_STOCKS.map(s =>
      `    <button class="btn btn-sm recent-chip" data-symbol="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join('')
  container.querySelectorAll('.recent-chip').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('stock-symbol').value = el.dataset.symbol
      loadStockData(el.dataset.symbol)
    })
  })
}

async function loadStockData(symbol) {
  if (!symbol) return
  addRecentStock(symbol)

  if (searchController) searchController.abort()
  searchController = new AbortController()
  const signal = searchController.signal

  // Show loading
  ;['stock-summary','stock-details','stock-price','stock-trade','stock-intraday'].forEach(id => {
    const el = document.getElementById(id)
    if (id === 'stock-summary') el.innerHTML = '<div class="loading-msg"><span class="spinner"></span></div>'
    else el.innerHTML = '<span class="spinner"></span> Loading...'
  })

  const [detailRes, tradeRes, intradayRes] = await Promise.allSettled([
    apiFetch(`/api/equity/${symbol}`, { signal }).then(d => ({ id: 'detail', data: d })),
    apiFetch(`/api/equity/tradeInfo/${symbol}`, { signal }).then(d => ({ id: 'trade', data: d })),
    apiFetch(`/api/equity/intraday/${symbol}`, { signal }).then(d => ({ id: 'intraday', data: d })),
  ])

  if (detailRes.status === 'fulfilled') {
    renderStockSummary(detailRes.value.data, symbol)
    renderStockDetails(detailRes.value.data)
    renderStockPrice(detailRes.value.data)
  } else {
    document.getElementById('stock-summary').innerHTML =
      `<div class="error-banner">${escapeHtml(symbol)}: ${detailRes.reason?.message || 'Failed to load'}</div>`
    showError('stock-details', detailRes.reason)
    showError('stock-price', detailRes.reason)
  }

  if (tradeRes.status === 'fulfilled') {
    renderOrderBook(tradeRes.value.data, symbol)
  } else {
    showError('stock-trade', tradeRes.reason)
  }

  if (intradayRes.status === 'fulfilled') {
    renderIntraday(intradayRes.value.data, symbol)
  } else {
    showError('stock-intraday', intradayRes.reason)
  }

  document.getElementById('stock-summary').style.display = 'flex'
}

// ── Stock Summary Bar ───────────────────────────────────────
function renderStockSummary(data, symbol) {
  const pi = data?.priceInfo || {}
  const info = data?.info || {}
  const lastPrice = pi.lastPrice
  const change = pi.change
  const pct = pi.pChange
  const chgColor = colorClass(change)

  const container = document.getElementById('stock-summary')
  container.innerHTML = `
    <div class="ss-symbol">${escapeHtml(symbol)}</div>
    <div class="ss-company">${escapeHtml(info.companyName || '')}</div>
    <div class="ss-price">
      <span class="value-lg ${chgColor}">${formatNum(lastPrice)}</span>
      <span class="change-sm ${chgColor}">${arrow(change)}${formatNum(change)} (${formatNum(pct)}%)</span>
    </div>
    <div class="ss-meta">
      <span>Prev: ${formatNum(pi.previousClose)}</span>
      <span>Open: ${formatNum(pi.open)}</span>
      <span>VWAP: ${formatNum(pi.vwap)}</span>
      <span>ISIN: ${info.isin || ''}</span>
    </div>
  `.trim()
  container.style.display = 'flex'
}

// ── Company Details ─────────────────────────────────────────
function renderStockDetails(data) {
  const container = document.getElementById('stock-details')
  const info = data?.info || {}
  const meta = data?.metadata || {}
  const sec = data?.securityInfo || {}
  const surv = sec?.surveillance || {}

  const fields = [
    ['Company', info.companyName],
    ['Symbol', info.symbol],
    ['ISIN', info.isin],
    ['Series', meta.series],
    ['Status', meta.status],
    ['Industry', meta.industry || info.industry],
    ['Board Status', sec.boardStatus],
    ['Trading Status', sec.tradingStatus],
    ['Segment', sec.tradingSegment],
    ['F&O Available', info.isFNOSec ? 'Yes' : 'No'],
    ['SLB', sec.slb],
    ['Class of Share', sec.classOfShare],
    ['Listed', info.isDelisted ? 'Delisted' : 'Active'],
    ['Suspended', info.isSuspended ? 'Yes' : 'No'],
    ['ETF', info.isETFSec ? 'Yes' : 'No'],
    ['Top 10', info.isTop10 ? 'Yes' : 'No'],
  ]

  let html = '<div class="detail-grid">'
  fields.forEach(([label, val]) => {
    if (!val && val !== 0) return
    html += `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${escapeHtml(String(val))}</span></div>`
  })
  html += '</div>'
  container.innerHTML = html
}

// ── Price Snapshot ──────────────────────────────────────────
function renderStockPrice(data) {
  const container = document.getElementById('stock-price')
  const pi = data?.priceInfo || {}
  const ihl = pi.intraDayHighLow || {}
  const whl = pi.weekHighLow || {}

  const stats = [
    ['Open', pi.open],
    ['High', ihl.max],
    ['Low', ihl.min],
    ['Prev Close', pi.previousClose],
    ['VWAP', pi.vwap],
    ['52W High', whl.max],
    ['52W Low', whl.min],
    ['Change', pi.change, colorClass(pi.change)],
    ['Change %', pi.pChange ? pi.pChange + '%' : '', colorClass(pi.pChange)],
  ]

  let html = '<div class="stats-grid">'
  stats.forEach(([label, val, cls]) => {
    if (val === null || val === undefined || val === '') return
    html += `<div class="stat-item"><span class="stat-label">${label}</span><span class="stat-value ${cls || ''}">${formatNum(val)}</span></div>`
  })
  html += '</div>'
  container.innerHTML = html
}

// ── Order Book ──────────────────────────────────────────────
function renderOrderBook(data, symbol) {
  const container = document.getElementById('stock-trade')
  const ob = data?.marketDeptOrderBook || {}

  if (!ob?.bid?.length && !ob?.ask?.length) {
    container.innerHTML = '<div class="empty-msg">No order book data</div>'
    return
  }

  const bids = (ob.bid || []).slice(0, 5)
  const asks = (ob.ask || []).slice(0, 5)

  let html = `
    <div class="ob-header">
      <span class="ob-summary">Bid Qty: ${formatNum(ob.totalBuyQuantity || 0)} &nbsp;|&nbsp; Ask Qty: ${formatNum(ob.totalSellQuantity || 0)}</span>
    </div>
    <div class="ob-grid">
      <div class="ob-side">
        <div class="ob-side-title down">Bids (${bids.length})</div>
        <div class="ob-row ob-head">
          <span>Price</span><span>Qty</span>
        </div>
        ${bids.map(b => `<div class="ob-row"><span class="down">${formatNum(b.price)}</span><span>${b.quantity.toLocaleString()}</span></div>`).join('')}
        ${bids.length < 5 ? `<div class="ob-row"><span colspan="2" style="color:var(--text-secondary)">—</span></div>` : ''}
      </div>
      <div class="ob-side">
        <div class="ob-side-title up">Asks (${asks.length})</div>
        <div class="ob-row ob-head">
          <span>Price</span><span>Qty</span>
        </div>
        ${asks.map(b => `<div class="ob-row"><span class="up">${formatNum(b.price)}</span><span>${b.quantity.toLocaleString()}</span></div>`).join('')}
        ${asks.length < 5 ? `<div class="ob-row"><span colspan="2" style="color:var(--text-secondary)">—</span></div>` : ''}
      </div>
    </div>`

  // Bulk/block deals
  const bulk = data?.bulkBlockDeals || []
  if (bulk.length) {
    html += `<details class="ob-deals"><summary>Block / Bulk Deals (${bulk.length})</summary>`
    html += `<div class="table-wrap"><table><thead><tr><th>Price</th><th>Qty</th><th>Type</th></tr></thead><tbody>`
    html += bulk.map(d => `<tr><td>${formatNum(d.price)}</td><td>${formatNum(d.quantity)}</td><td>${escapeHtml(d.type || '')}</td></tr>`).join('')
    html += `</tbody></table></div></details>`
  }

  container.innerHTML = html
}

// ── Intraday ────────────────────────────────────────────────
function renderIntraday(data, symbol) {
  const container = document.getElementById('stock-intraday')
  const graphData = data?.grapthData || []

  if (!graphData.length) {
    container.innerHTML = '<div class="empty-msg">No intraday data (market may be closed)</div>'
    return
  }

  // Parse: [timestamp, price, ...]
  const points = graphData.filter(p => p && p.length >= 2).map(p => ({
    time: new Date(p[0]),
    price: parseFloat(p[1]),
  }))

  if (!points.length) {
    container.innerHTML = '<div class="empty-msg">No intraday data</div>'
    return
  }

  const prices = points.map(p => p.price)
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const last = prices[prices.length - 1]
  const first = prices[0]
  const chg = last - first
  const range = high - low

  // Compute duration from timestamps
  const times = points.filter(p => p.time.getTime()).map(p => p.time)
  const firstTime = times[0]
  const lastTime = times[times.length - 1]
  const duration = lastTime && firstTime ? Math.round((lastTime - firstTime) / 60000) : 0

  // Summary stats
  let html = `<div class="intra-summary">
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
      <div class="stat-item"><span class="stat-label">Data Points</span><span class="stat-value">${points.length.toLocaleString()}</span></div>
      <div class="stat-item"><span class="stat-label">High</span><span class="stat-value up">${formatNum(high)}</span></div>
      <div class="stat-item"><span class="stat-label">Low</span><span class="stat-value down">${formatNum(low)}</span></div>
      <div class="stat-item"><span class="stat-label">Last</span><span class="stat-value ${colorClass(chg)}">${formatNum(last)}</span></div>
      <div class="stat-item"><span class="stat-label">Range</span><span class="stat-value">${formatNum(range)}</span></div>
      <div class="stat-item"><span class="stat-label">Duration</span><span class="stat-value">${duration > 60 ? Math.round(duration/60) + 'h ' : ''}${duration % 60}m</span></div>
    </div>
  </div>`

  // Mini table of recent ticks
  const recent = points.slice(-50).reverse()
  html += `<details class="intra-details" open>
    <summary>Recent Trades (last ${Math.min(points.length, 50)} of ${points.length})</summary>
    <div class="table-wrap"><table><thead><tr><th>Time</th><th>Price</th><th>Chg</th></tr></thead><tbody>`
  html += recent.map((p, i) => {
    const prev = i < recent.length - 1 ? recent[i + 1]?.price : p.price
    const diff = p.price - prev
    return `<tr>
      <td>${p.time.toLocaleTimeString()}</td>
      <td class="num ${colorClass(diff)}">${formatNum(p.price)}</td>
      <td class="num ${colorClass(diff)}">${diff !== 0 ? arrow(diff) + formatNum(Math.abs(diff)) : '—'}</td>
    </tr>`
  }).join('')
  html += `</tbody></table></div></details>`

  container.innerHTML = html
}

// ── Indices Tab ─────────────────────────────────────────────
let indexNamesCache = []

async function loadIndexNames() {
  if (indexNamesCache.length) return
  const raw = await apiFetch('/api/indexNames')
  indexNamesCache = raw?.stn || raw || []
}

function populateIndexSelect() {
  const sels = ['index-select', 'opt-index-select']
  sels.forEach(id => {
    const sel = document.getElementById(id)
    if (!sel || !indexNamesCache.length) return
    sel.innerHTML = '<option value="">Select index...</option>' +
      indexNamesCache.map(i => {
        const key = Array.isArray(i) ? i[0] : i.key || i
        const label = Array.isArray(i) ? i[1] || i[0] : i.index || i.key || i
        return `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`
      }).join('')
  })
}

function initIndicesTab() {
  const loadingEl = document.getElementById('ix-loading')
  loadingEl.textContent = 'Loading indices...'
  loadIndexNames().then(() => {
    populateIndexSelect()
    loadingEl.textContent = ''
  }).catch(err => { loadingEl.textContent = 'Failed to load'; showError('ix-summary', err) })

  document.getElementById('index-go')?.addEventListener('click', () => {
    const sel = document.getElementById('index-select')
    if (sel?.value) loadIndexData(sel.value)
  })

  document.getElementById('ix-filter')?.addEventListener('input', () => {
    const q = document.getElementById('ix-filter')?.value.toUpperCase() || ''
    const table = document.querySelector('#index-stocks table')
    if (!table) return
    table.querySelectorAll('tbody tr').forEach(r => {
      r.style.display = r.textContent.toUpperCase().includes(q) ? '' : 'none'
    })
  })
}

async function loadIndexData(indexKey) {
  const summaryEl = document.getElementById('ix-summary')
  const stocksEl = document.getElementById('index-stocks')
  const glEl = document.getElementById('index-gl')
  const activeEl = document.getElementById('index-active')

  ;[stocksEl, glEl, activeEl].forEach(el => {
    if (!el.classList.contains('empty-msg')) el.innerHTML = '<span class="spinner"></span> Loading...'
  })
  summaryEl.style.display = 'none'

  const [ixRes, glRes, activeRes] = await Promise.allSettled([
    apiFetch(`/api/index/${indexKey}`).then(d => ({ id: 'ix', data: d })),
    apiFetch(`/api/gainersAndLosers/${indexKey}`).then(d => ({ id: 'gl', data: d })),
    apiFetch(`/api/mostActive/${indexKey}`).then(d => ({ id: 'active', data: d })),
  ])

  if (ixRes.status === 'fulfilled') {
    renderIndexSummary(ixRes.value.data, indexKey)
    renderIndexConstituents(ixRes.value.data)
  } else {
    summaryEl.innerHTML = `<div class="error-banner">${ixRes.reason?.message || 'Failed to load'}</div>`
    summaryEl.style.display = 'flex'
    stocksEl.innerHTML = '<div class="empty-msg">Failed to load constituents</div>'
  }

  if (glRes.status === 'fulfilled') {
    renderGainersLosers(glRes.value.data)
  } else {
    glEl.innerHTML = '<div class="empty-msg">No gainers/losers data</div>'
  }

  if (activeRes.status === 'fulfilled') {
    renderMostActive(activeRes.value.data)
  } else {
    activeEl.innerHTML = '<div class="empty-msg">No most active data</div>'
  }
}

// ── Index Summary ───────────────────────────────────────────
function renderIndexSummary(data, indexKey) {
  const meta = data?.metadata || {}
  const adv = data?.advance || {}
  const container = document.getElementById('ix-summary')

  const chgColor = colorClass(meta.change || meta.percChange)
  container.innerHTML = `
    <div class="ss-symbol" style="font-size:20px">${escapeHtml(meta.indexName || indexKey)}</div>
    <div class="ss-price">
      <span class="value-lg ${chgColor}">${formatNum(meta.last)}</span>
      <span class="change-sm ${chgColor}">${arrow(meta.change)}${formatNum(meta.change)} (${formatNum(meta.percChange)}%)</span>
    </div>
    <div class="ss-meta">
      <span>O: ${formatNum(meta.open)}</span>
      <span>H: ${formatNum(meta.high)}</span>
      <span>L: ${formatNum(meta.low)}</span>
      <span>Prev: ${formatNum(meta.previousClose)}</span>
      <span>Adv: <span class="up">${adv.advances || 0}</span></span>
      <span>Dec: <span class="down">${adv.declines || 0}</span></span>
      <span>Unch: ${adv.unchanged || 0}</span>
      <span>Vol: ${formatNum(meta.totalTradedVolume)}</span>
    </div>
  `.trim()
  container.style.display = 'flex'
}

// ── Constituents ────────────────────────────────────────────
function renderIndexConstituents(data) {
  const container = document.getElementById('index-stocks')
  const stocks = data?.data || []

  if (!stocks.length) {
    container.innerHTML = '<div class="empty-msg">No constituent data available (market may be closed)</div>'
    return
  }

  container.dataset.fullData = JSON.stringify(stocks)

  const headers = ['Symbol', 'Company', 'Last Price', 'Change', '%Change', 'Weight']
  let html = `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`
  html += stocks.map(s => {
    const chgColor = colorClass(s.change || s.priceChange)
    return `<tr>
      <td><strong>${escapeHtml(s.symbol || s.tradingSymbol || '')}</strong></td>
      <td>${escapeHtml(s.companyName || '')}</td>
      <td class="num ${chgColor}">${formatNum(s.lastPrice || s.ltp || s.price)}</td>
      <td class="num ${chgColor}">${arrow(s.change || s.priceChange)}${formatNum(Math.abs(s.change || s.priceChange || 0))}</td>
      <td class="num ${chgColor}">${formatNum(s.perChange || s.percChange || s.pChange)}%</td>
      <td class="num">${s.weight != null ? s.weight + '%' : '—'}</td>
    </tr>`
  }).join('')
  html += `</tbody></table></div><p class="row-count">${stocks.length} constituents</p>`
  container.innerHTML = html
}

// ── Gainers & Losers ────────────────────────────────────────
function renderGainersLosers(data) {
  const container = document.getElementById('index-gl')
  const gainers = data?.gainers || []
  const losers = data?.losers || []

  if (!gainers.length && !losers.length) {
    container.innerHTML = '<div class="empty-msg">No gainers/losers data</div>'
    return
  }

  let html = '<div class="gl-grid">'

  // Gainers
  html += `<div class="gl-side"><div class="gl-title up">Gainers (${gainers.length})</div>`
  if (gainers.length) {
    html += `<div class="ob-row ob-head"><span>Symbol</span><span>Price</span><span>Chg%</span></div>`
    html += gainers.slice(0, 10).map(s => {
      const sym = s.symbol || s.tradingSymbol || ''
      const chg = s.perChange || s.percChange || s.pChange || 0
      return `<div class="ob-row"><span>${escapeHtml(sym)}</span><span class="num up">${formatNum(s.lastPrice || s.ltp)}</span><span class="num up">+${formatNum(chg)}%</span></div>`
    }).join('')
  } else {
    html += '<div class="empty-msg" style="padding:12px">—</div>'
  }
  html += '</div>'

  // Losers
  html += `<div class="gl-side"><div class="gl-title down">Losers (${losers.length})</div>`
  if (losers.length) {
    html += `<div class="ob-row ob-head"><span>Symbol</span><span>Price</span><span>Chg%</span></div>`
    html += losers.slice(0, 10).map(s => {
      const sym = s.symbol || s.tradingSymbol || ''
      const chg = s.perChange || s.percChange || s.pChange || 0
      return `<div class="ob-row"><span>${escapeHtml(sym)}</span><span class="num down">${formatNum(s.lastPrice || s.ltp)}</span><span class="num down">${formatNum(chg)}%</span></div>`
    }).join('')
  } else {
    html += '<div class="empty-msg" style="padding:12px">—</div>'
  }
  html += '</div>'

  html += '</div>'
  container.innerHTML = html
}

// ── Most Active ─────────────────────────────────────────────
function renderMostActive(data) {
  const container = document.getElementById('index-active')
  const byVol = data?.byVolume || []
  const byVal = data?.byValue || []

  if (!byVol.length && !byVal.length) {
    container.innerHTML = '<div class="empty-msg">No most active data</div>'
    return
  }

  let html = '<div class="gl-grid">'

  if (byVol.length) {
    html += `<div class="gl-side"><div class="gl-title">By Volume</div><div class="ob-row ob-head"><span>Symbol</span><span>Price</span><span>Volume</span></div>`
    html += byVol.slice(0, 10).map(s => {
      const chgColor = colorClass(s.perChange || s.percChange || s.pChange)
      return `<div class="ob-row"><span>${escapeHtml(s.symbol || s.tradingSymbol || '')}</span><span class="num ${chgColor}">${formatNum(s.lastPrice || s.ltp)}</span><span class="num">${formatNum(s.totalTradedVolume || s.volume)}</span></div>`
    }).join('')
    html += '</div>'
  }

  if (byVal.length) {
    html += `<div class="gl-side"><div class="gl-title">By Value</div><div class="ob-row ob-head"><span>Symbol</span><span>Price</span><span>Value</span></div>`
    html += byVal.slice(0, 10).map(s => {
      const chgColor = colorClass(s.perChange || s.percChange || s.pChange)
      return `<div class="ob-row"><span>${escapeHtml(s.symbol || s.tradingSymbol || '')}</span><span class="num ${chgColor}">${formatNum(s.lastPrice || s.ltp)}</span><span class="num">${formatNum(s.totalTradedValue || s.value)}</span></div>`
    }).join('')
    html += '</div>'
  }

  html += '</div>'
  container.innerHTML = html
}

// ── Options Tab ─────────────────────────────────────────────
let optAllData = []
let optExpiryIdx = 0
let optUnderlyingVal = 0

function initOptionsTab() {
  setupAutocomplete('opt-symbol', 'opt-suggestions')

  document.getElementById('opt-type')?.addEventListener('change', () => {
    const type = document.getElementById('opt-type')?.value
    document.getElementById('opt-equity-controls').style.display = type === 'equity' ? '' : 'none'
    document.getElementById('opt-index-controls').style.display = type === 'index' ? '' : 'none'
  })

  document.getElementById('opt-go')?.addEventListener('click', () => {
    const type = document.getElementById('opt-type')?.value
    if (type === 'equity') {
      const sym = document.getElementById('opt-symbol')?.value.trim().toUpperCase()
      if (sym) loadOptionsData('equity', sym)
    } else if (type === 'index') {
      const idx = document.getElementById('opt-index-select')?.value
      if (idx) loadOptionsData('index', idx)
    }
  })
}

async function loadOptionsData(type, key) {
  const url = type === 'equity' ? `/api/equity/options/${key}` : `/api/index/options/${key}`
  const id = 'opt-result'
  const underlyingEl = document.getElementById('opt-underlying')
  const expiriesEl = document.getElementById('opt-expiries')

  showLoading(id, 'Loading option chain...')
  underlyingEl.style.display = 'none'
  expiriesEl.style.display = 'none'

  try {
    const data = await apiFetch(url)

    // Normalize: equity options have data[] with optionType CE/PE rows,
    // index options have records.data[] with nested CE/PE per row
    let records = data?.data || data?.records?.data || []
    const underlyingVal = data?.records?.underlyingValue || records[0]?.underlyingValue || 0

    // If index options (nested CE/PE), flatten into separate records
    if (data?.records?.data && data.records.data[0]?.CE && data.records.data[0]?.PE) {
      const flat = []
      data.records.data.forEach(row => {
        if (row.CE) flat.push({ ...row.CE, optionType: 'CE', expiryDate: row.expiryDates || row.CE.expiryDate, strikePrice: row.CE.strikePrice })
        if (row.PE) flat.push({ ...row.PE, optionType: 'PE', expiryDate: row.expiryDates || row.PE.expiryDate, strikePrice: row.PE.strikePrice })
      })
      records = flat
    }

    if (!records.length) {
      document.getElementById(id).innerHTML = '<div class="empty-msg">No option chain data</div>'
      return
    }

    optAllData = records
    optUnderlyingVal = underlyingVal
    const underlyingName = records[0]?.underlying || key

    // Show underlying
    underlyingEl.innerHTML = `
      <div class="ss-symbol" style="font-size:18px">${escapeHtml(underlyingName)}</div>
      <div class="ss-price"><span class="value-lg">${formatNum(optUnderlyingVal)}</span></div>
      <div class="ss-meta"><span>${records.length} contracts</span><span>As of ${records[0]?.timestamp || ''}</span></div>
    `.trim()
    underlyingEl.style.display = 'flex'

    // Extract unique expiries
    const expiries = [...new Set(records.map(r => r.expiryDate))].sort((a, b) => {
      const parseD = (s) => { const p = s.split('-'); const ms={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11}; const month = ms[p[1]]; return new Date(parseInt(p[2]), month !== undefined ? month : new Date(s).getMonth(), parseInt(p[0])) }
      return parseD(a) - parseD(b)
    })

    if (expiries.length > 1) {
      expiriesEl.style.display = 'flex'
      expiriesEl.innerHTML = '<span class="expiry-label">Expiry:</span>' +
        expiries.map((e, i) =>
          `<button class="btn btn-sm expiry-chip ${i === 0 ? 'active' : ''}" data-idx="${i}">${e}</button>`
        ).join('')
      expiriesEl.querySelectorAll('.expiry-chip').forEach(el => {
        el.addEventListener('click', () => {
          expiriesEl.querySelectorAll('.expiry-chip').forEach(b => b.classList.remove('active'))
          el.classList.add('active')
          optExpiryIdx = parseInt(el.dataset.idx)
          renderOptionChain(expiries[optExpiryIdx])
        })
      })
    } else {
      expiriesEl.style.display = 'none'
    }

    optExpiryIdx = 0
    renderOptionChain(expiries[0])
  } catch (err) {
    showError(id, err, () => loadOptionsData(type, key))
  }
}

function renderOptionChain(expiryDate) {
  const container = document.getElementById('opt-result')
  const records = optAllData.filter(r => r.expiryDate === expiryDate)

  if (!records.length) {
    container.innerHTML = '<div class="empty-msg">No contracts for this expiry</div>'
    return
  }

  // Group by strike
  const byStrike = {}
  records.forEach(r => {
    const strike = String(r.strikePrice || '').trim()
    if (!byStrike[strike]) byStrike[strike] = {}
    if (r.optionType === 'CE') byStrike[strike].ce = r
    else if (r.optionType === 'PE') byStrike[strike].pe = r
  })

  const strikes = Object.keys(byStrike).sort((a, b) => parseFloat(a) - parseFloat(b))
  const atmStrike = strikes.reduce((best, s) =>
    Math.abs(parseFloat(s) - optUnderlyingVal) < Math.abs(parseFloat(best) - optUnderlyingVal) ? s : best
  )

  let html = `<div class="oc-header">${escapeHtml(expiryDate)} · ${strikes.length} strikes · ATM ~${formatNum(parseFloat(atmStrike))}</div>`

  html += `<div class="table-wrap"><table class="oc-table"><thead><tr>
    <th class="oc-p ec">CE OI</th>
    <th class="oc-p ec">CE Chg OI</th>
    <th class="oc-p ec">CE Vol</th>
    <th class="oc-p ec">CE LTP</th>
    <th class="oc-p ec">CE Chg%</th>
    <th class="oc-strike">Strike</th>
    <th class="oc-p ep">PE Chg%</th>
    <th class="oc-p ep">PE LTP</th>
    <th class="oc-p ep">PE Vol</th>
    <th class="oc-p ep">PE Chg OI</th>
    <th class="oc-p ep">PE OI</th>
  </tr></thead><tbody>`

  strikes.forEach(strike => {
    const s = byStrike[strike]
    const ce = s?.ce || {}
    const pe = s?.pe || {}
    const isATM = strike === atmStrike

    const ceCls = colorClass(ce.pchange)
    const peCls = colorClass(pe.pchange)
    const ceOiCls = colorClass(ce.pchangeinOpenInterest)
    const peOiCls = colorClass(pe.pchangeinOpenInterest)

    html += `<tr class="${isATM ? 'oc-atm' : ''}">
      <td class="num ec">${ce.openInterest ? formatNum(ce.openInterest) : '—'}</td>
      <td class="num ec ${ceOiCls}">${ce.pchangeinOpenInterest ? formatNum(ce.pchangeinOpenInterest) + '%' : '—'}</td>
      <td class="num ec">${ce.totalTradedVolume ? formatNum(ce.totalTradedVolume) : '—'}</td>
      <td class="num ec ${ceCls}">${ce.lastPrice != null ? formatNum(ce.lastPrice) : '—'}</td>
      <td class="num ec ${ceCls}">${ce.pchange != null ? formatNum(ce.pchange) + '%' : '—'}</td>
      <td class="num oc-strike"><strong>${formatNum(parseFloat(strike))}</strong></td>
      <td class="num ep ${peCls}">${pe.pchange != null ? formatNum(pe.pchange) + '%' : '—'}</td>
      <td class="num ep ${peCls}">${pe.lastPrice != null ? formatNum(pe.lastPrice) : '—'}</td>
      <td class="num ep">${pe.totalTradedVolume ? formatNum(pe.totalTradedVolume) : '—'}</td>
      <td class="num ep ${peOiCls}">${pe.pchangeinOpenInterest ? formatNum(pe.pchangeinOpenInterest) + '%' : '—'}</td>
      <td class="num ep">${pe.openInterest ? formatNum(pe.openInterest) : '—'}</td>
    </tr>`
  })

  html += `</tbody></table></div>`
  html += `<p class="row-count">${strikes.length} strikes · Expiry: ${escapeHtml(expiryDate)}</p>`

  container.innerHTML = html
}

// ── Charts Tab ──────────────────────────────────────────────
function initChartsTab() {
  setupAutocomplete('chart-symbol', 'chart-suggestions')

  document.getElementById('chart-go')?.addEventListener('click', () => {
    const symbol = document.getElementById('chart-symbol')?.value.trim().toUpperCase()
    if (symbol) loadChartData(symbol)
  })
}

async function loadChartData(symbol) {
  const chartType = document.getElementById('chart-type')?.value || 'I'
  const interval = document.getElementById('chart-interval')?.value || '5'
  const id = 'chart-result'
  const summaryEl = document.getElementById('chart-summary')

  showLoading(id, 'Loading chart data...')
  summaryEl.style.display = 'none'

  try {
    const data = await apiFetch(`/api/charts/equity-historical-data?symbol=${symbol}&chartType=${chartType}&timeInterval=${interval}`)
    const candles = data?.data || (Array.isArray(data) ? data : [])

    if (!candles.length) {
      document.getElementById(id).innerHTML = '<div class="empty-msg">No chart data</div>'
      return
    }

    renderChartSummary(candles, symbol, chartType, interval)
    renderCandles(candles)
  } catch (err) {
    showError(id, err, () => loadChartData(symbol))
  }
}

function renderChartSummary(candles, symbol, chartType, interval) {
  const container = document.getElementById('chart-summary')
  const open = candles[0]?.open
  const close = candles[candles.length - 1]?.close
  const high = Math.max(...candles.map(c => c.high))
  const low = Math.min(...candles.map(c => c.low))
  const vol = candles.reduce((s, c) => s + (c.volume || 0), 0)
  const chg = close - open
  const chgColor = colorClass(chg)

  container.innerHTML = `
    <div class="ss-symbol" style="font-size:18px">${escapeHtml(symbol)}</div>
    <div class="ss-meta" style="font-size:11px">${chartType === 'I' ? 'Intraday' : 'Daily'} · ${interval}min · ${candles.length} candles</div>
    <div class="ss-price">
      <span class="value-lg ${chgColor}">${formatNum(close)}</span>
      <span class="change-sm ${chgColor}">${arrow(chg)}${formatNum(chg)}</span>
    </div>
    <div class="ss-meta">
      <span>O: ${formatNum(open)}</span>
      <span>H: <span class="up">${formatNum(high)}</span></span>
      <span>L: <span class="down">${formatNum(low)}</span></span>
      <span>Vol: ${formatNum(vol)}</span>
    </div>
  `.trim()
  container.style.display = 'flex'
}

function renderCandles(candles) {
  const container = document.getElementById('chart-result')

  // Show last 100 candles in table
  const shown = candles.slice(-100).reverse()

  let html = `<div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(100px,1fr));margin-bottom:12px">
    <div class="stat-item"><span class="stat-label">Candles</span><span class="stat-value">${candles.length}</span></div>
    <div class="stat-item"><span class="stat-label">High</span><span class="stat-value up">${formatNum(Math.max(...candles.map(c=>c.high)))}</span></div>
    <div class="stat-item"><span class="stat-label">Low</span><span class="stat-value down">${formatNum(Math.min(...candles.map(c=>c.low)))}</span></div>
    <div class="stat-item"><span class="stat-label">Volume</span><span class="stat-value">${formatNum(candles.reduce((s,c)=>s+(c.volume||0),0))}</span></div>
  </div>`

  html += `<div class="table-wrap"><table><thead><tr>
    <th>Time</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Chg</th><th>Volume</th>
  </tr></thead><tbody>`

  shown.forEach((c, i) => {
    const prevClose = i < shown.length - 1 ? shown[i + 1]?.close : c.close
    const chg = c.close - prevClose
    const chgColor = colorClass(chg)
    const dir = c.close >= c.open ? 'up' : 'down'
    html += `<tr>
      <td>${new Date(c.time || c.timestamp).toLocaleTimeString()}</td>
      <td class="num">${formatNum(c.open)}</td>
      <td class="num up">${formatNum(c.high)}</td>
      <td class="num down">${formatNum(c.low)}</td>
      <td class="num ${dir}"><strong>${formatNum(c.close)}</strong></td>
      <td class="num ${chgColor}">${arrow(chg)}${formatNum(chg)}</td>
      <td class="num">${formatNum(c.volume || 0)}</td>
    </tr>`
  })

  html += `</tbody></table></div>`
  html += `<p class="row-count">${candles.length} candles · showing last ${shown.length}</p>`
  container.innerHTML = html
  maybeShowStockAskAI()
}


const TECH_REFS = {
  sma: 'Simple Moving Average — average price over N periods. Higher periods = smoother line. Crossovers signal trend changes.',
  ema: 'Exponential Moving Average — weights recent prices more. Reacts faster than SMA. Common signals: price/MA crossovers.',
  macd: 'Moving Average Convergence Divergence — trend-following momentum. Signal line crossovers and histogram zero-line crossovers generate signals.',
  adx: 'Average Directional Index — measures trend strength (not direction). >25 = strong trend, <20 = weak/choppy.',
  rsi: 'Relative Strength Index — momentum oscillator (0-100). >70 overbought (sell), <30 oversold (buy). Divergences signal reversals.',
  stoch: 'Stochastic Oscillator — compares close to price range. >80 overbought, <20 oversold. %K/%D crossovers generate signals.',
  wr: 'Williams %R — momentum oscillator (-100 to 0). Below -80 oversold (buy), above -20 overbought (sell).',
  cci: 'Commodity Channel Index — measures deviation from statistical mean. >100 overbought, <-100 oversold. Also detects trend strength.',
  mfi: 'Money Flow Index — volume-weighted RSI. >80 overbought, <20 oversold. Divergences with price signal reversals.',
  roc: 'Rate of Change — raw momentum: (close[N] - close) / close * 100. Positive = gaining, negative = losing. Extreme values signal reversals.',
  mom: 'Momentum — close - close[N periods ago]. Rising momentum confirms trend, falling momentum warns of reversal.',
  bb: 'Bollinger Bands — volatility bands around SMA. Price touching upper band = overextended up, lower = oversold. Squeeze signals breakout.',
  atr: 'Average True Range — measures market volatility. Higher ATR = wider stops needed. Useful for position sizing and stop placement.',
  obv: 'On-Balance Volume — cumulative volume based on price direction. Confirms trends: OBV rising with price = strong uptrend. Divergences warn of reversals.',
}

const TECH_SIGNAL_MAP = {
  rsi: { low: 30, high: 70, label: 'RSI', format: v => v != null ? v.toFixed(1) : '—' },
  stochastic: { low: 20, high: 80, label: 'Stochastic', format: v => v?.k != null ? `${v.k.toFixed(1)}/${v.d.toFixed(1)}` : '—' },
  williamsR: { low: -80, high: -20, label: 'Williams %R', format: v => v != null ? v.toFixed(1) : '—' },
  cci: { low: -100, high: 100, label: 'CCI', format: v => v != null ? v.toFixed(1) : '—' },
  mfi: { low: 20, high: 80, label: 'MFI', format: v => v != null ? v.toFixed(1) : '—' },
  adx: { low: 25, high: null, label: 'ADX', format: v => v != null ? v.toFixed(1) : '—' },
}

function signalClass(val, low, high) {
  if (val == null) return ''
  if (high != null && val >= high) return 'down'    // overbought
  if (low != null && val <= low) return 'up'         // oversold (good for buying)
  return ''
}

function signalLabel(val, low, high) {
  if (val == null) return '—'
  if (high != null && val >= high) return 'Overbought'
  if (low != null && val <= low) return 'Oversold'
  return 'Neutral'
}

function initTechnicalTab() {
  setupAutocomplete('tech-symbol', 'tech-suggestions')

  document.getElementById('tech-go')?.addEventListener('click', () => {
    const symbol = document.getElementById('tech-symbol')?.value.trim().toUpperCase()
    if (symbol) loadTechnicalData(symbol)
  })
}

async function loadTechnicalData(symbol) {
  const period = document.getElementById('tech-period')?.value || 200

  const params = new URLSearchParams()
  params.set('period', period)
  if (document.getElementById('tech-sma')?.checked) params.set('smaPeriods', document.getElementById('tech-sma-p')?.value || '5,10,20,50,100,200')
  if (document.getElementById('tech-ema')?.checked) params.set('emaPeriods', document.getElementById('tech-ema-p')?.value || '5,10,20,50,100,200')
  if (document.getElementById('tech-rsi')?.checked) params.set('rsiPeriod', document.getElementById('tech-rsi-p')?.value || 14)
  if (document.getElementById('tech-bb')?.checked) { params.set('bbPeriod', document.getElementById('tech-bb-p')?.value || 20); params.set('bbStdDev', document.getElementById('tech-bb-s')?.value || 2) }
  if (document.getElementById('tech-macd')?.checked) { params.set('macdFast', document.getElementById('tech-macd-f')?.value || 12); params.set('macdSlow', document.getElementById('tech-macd-s')?.value || 26); params.set('macdSignal', document.getElementById('tech-macd-m')?.value || 9) }
  if (document.getElementById('tech-stoch')?.checked) { params.set('stochK', document.getElementById('tech-stoch-k')?.value || 14); params.set('stochD', document.getElementById('tech-stoch-d')?.value || 3) }
  if (document.getElementById('tech-wr')?.checked) params.set('williamsRPeriod', document.getElementById('tech-wr-p')?.value || 14)
  if (document.getElementById('tech-atr')?.checked) params.set('atrPeriod', document.getElementById('tech-atr-p')?.value || 14)
  if (document.getElementById('tech-adx')?.checked) params.set('adxPeriod', document.getElementById('tech-adx-p')?.value || 14)
  if (document.getElementById('tech-cci')?.checked) params.set('cciPeriod', document.getElementById('tech-cci-p')?.value || 20)
  if (document.getElementById('tech-mfi')?.checked) params.set('mfiPeriod', document.getElementById('tech-mfi-p')?.value || 14)
  if (document.getElementById('tech-roc')?.checked) params.set('rocPeriod', document.getElementById('tech-roc-p')?.value || 10)
  if (document.getElementById('tech-mom')?.checked) params.set('momentumPeriod', document.getElementById('tech-mom-p')?.value || 10)
  if (document.getElementById('tech-obv')?.checked) params.set('obvEnabled', 'true')

  const id = 'tech-result'
  const summaryEl = document.getElementById('tech-summary')
  const signalsEl = document.getElementById('tech-signals')

  showLoading(id, 'Calculating...')
  summaryEl.style.display = 'none'
  signalsEl.style.display = 'none'

  try {
    const data = await apiFetch(`/api/equity/technicalIndicators/${symbol}?${params.toString()}&showOnlyLatest=true`)
    renderTechSummary(data, symbol)
    renderTechSignals(data)
    renderTechTable(data)
  } catch (err) {
    showError(id, err, () => loadTechnicalData(symbol))
  }
}

function renderTechSummary(data, symbol) {
  const container = document.getElementById('tech-summary')
  const price = data?.vwap || data?.close || 0
  const rsi = data?.rsi

  container.innerHTML = `
    <div class="ss-symbol" style="font-size:18px">${escapeHtml(symbol)}</div>
    <div class="ss-price"><span class="value-lg">${formatNum(price)}</span></div>
    <div class="ss-meta">
      ${rsi != null ? `<span>RSI(14): <span class="${signalClass(rsi, 30, 70)}"><strong>${rsi.toFixed(1)}</strong> (${signalLabel(rsi, 30, 70)})</span></span>` : ''}
      <span>ADX: ${data?.adx != null ? data.adx.toFixed(1) : '—'}</span>
    </div>
  `.trim()
  container.style.display = 'flex'
}

function renderTechSignals(data) {
  const container = document.getElementById('tech-signals')
  const indicators = []

  if (data?.rsi != null) indicators.push({ name: 'RSI', value: data.rsi, ...TECH_SIGNAL_MAP.rsi, raw: data.rsi })
  if (data?.stochastic) indicators.push({ name: 'Stochastic', value: data.stochastic.k, ...TECH_SIGNAL_MAP.stochastic, raw: data.stochastic })
  if (data?.williamsR != null) indicators.push({ name: 'Williams %R', value: data.williamsR, ...TECH_SIGNAL_MAP.williamsR, raw: data.williamsR })
  if (data?.cci != null) indicators.push({ name: 'CCI', value: data.cci, ...TECH_SIGNAL_MAP.cci, raw: data.cci })
  if (data?.mfi != null) indicators.push({ name: 'MFI', value: data.mfi, ...TECH_SIGNAL_MAP.mfi, raw: data.mfi })
  if (data?.adx != null) indicators.push({ name: 'ADX', value: data.adx, ...TECH_SIGNAL_MAP.adx, raw: data.adx })

  if (!indicators.length) { container.style.display = 'none'; return }

  let html = '<div class="tech-signals-grid">'
  indicators.forEach(ind => {
    const cls = signalClass(ind.value, ind.low, ind.high)
    const lbl = signalLabel(ind.value, ind.low, ind.high)
    const fmt = ind.format(ind.raw)
    html += `<div class="tech-signal-card">
      <div class="tech-signal-name">${ind.name}</div>
      <div class="tech-signal-value ${cls}">${fmt}</div>
      <div class="tech-signal-label ${cls}">${lbl}</div>
    </div>`
  })
  html += '</div>'
  container.innerHTML = html
  container.style.display = 'block'
}

function renderTechTable(data) {
  const container = document.getElementById('tech-result')
  if (!data || Object.keys(data).length === 0) {
    container.innerHTML = '<div class="empty-msg">No technical data returned</div>'
    return
  }

  // Build groups
  const groups = [
    { name: 'Moving Averages', items: [] },
    { name: 'Oscillators', items: [] },
    { name: 'Volatility', items: [] },
    { name: 'Volume', items: [] },
    { name: 'Other', items: [] },
  ]

  // SMA
  if (data.sma) {
    Object.entries(data.sma).forEach(([k, v]) => {
      groups[0].items.push({ label: k.toUpperCase(), value: formatNum(v) })
    })
  }
  // EMA
  if (data.ema) {
    Object.entries(data.ema).forEach(([k, v]) => {
      groups[0].items.push({ label: k.toUpperCase(), value: formatNum(v) })
    })
  }
  // RSI
  if (data.rsi != null) {
    groups[1].items.push({ label: `RSI(${document.getElementById('tech-rsi-p')?.value || 14})`, value: data.rsi.toFixed(2), cls: signalClass(data.rsi, 30, 70) })
  }
  // Stochastic
  if (data.stochastic) {
    groups[1].items.push({ label: 'Stoch %K', value: data.stochastic.k?.toFixed(2), cls: signalClass(data.stochastic.k, 20, 80) })
    groups[1].items.push({ label: 'Stoch %D', value: data.stochastic.d?.toFixed(2), cls: signalClass(data.stochastic.d, 20, 80) })
  }
  // MACD
  if (data.macd) {
    groups[1].items.push({ label: 'MACD', value: data.macd.macd?.toFixed(2) })
    groups[1].items.push({ label: 'Signal', value: data.macd.signal?.toFixed(2) })
    groups[1].items.push({ label: 'Histogram', value: data.macd.histogram?.toFixed(2), cls: colorClass(data.macd.histogram) })
  }
  // Williams %R
  if (data.williamsR != null) {
    groups[1].items.push({ label: 'Williams %R', value: data.williamsR.toFixed(2), cls: signalClass(data.williamsR, -80, -20) })
  }
  // CCI
  if (data.cci != null) {
    groups[1].items.push({ label: 'CCI', value: data.cci.toFixed(2), cls: signalClass(data.cci, -100, 100) })
  }
  // MFI
  if (data.mfi != null) {
    groups[1].items.push({ label: 'MFI', value: data.mfi.toFixed(2), cls: signalClass(data.mfi, 20, 80) })
  }
  // ROC
  if (data.roc != null) {
    groups[1].items.push({ label: 'ROC', value: data.roc.toFixed(2), cls: colorClass(data.roc) })
  }
  // Momentum
  if (data.momentum != null) {
    groups[1].items.push({ label: 'Momentum', value: data.momentum.toFixed(2), cls: colorClass(data.momentum) })
  }
  // ADX
  if (data.adx != null) {
    groups[1].items.push({ label: 'ADX', value: data.adx.toFixed(2), cls: data.adx >= 25 ? 'up' : '' })
  }
  // Bollinger
  if (data.bollingerBands) {
    groups[2].items.push({ label: 'BB Upper', value: formatNum(data.bollingerBands.upper) })
    groups[2].items.push({ label: 'BB Middle', value: formatNum(data.bollingerBands.middle) })
    groups[2].items.push({ label: 'BB Lower', value: formatNum(data.bollingerBands.lower) })
  }
  // ATR
  if (data.atr != null) {
    groups[2].items.push({ label: 'ATR', value: formatNum(data.atr) })
  }
  // OBV
  if (data.obv != null) {
    groups[3].items.push({ label: 'OBV', value: formatNum(data.obv), cls: colorClass(data.obv) })
  }
  // VWAP
  if (data.vwap != null) {
    groups[3].items.push({ label: 'VWAP', value: formatNum(data.vwap) })
  }
  // AD
  if (data.ad != null) {
    groups[3].items.push({ label: 'A/D Line', value: formatNum(data.ad), cls: colorClass(data.ad) })
  }

  let html = ''
  groups.forEach(g => {
    if (!g.items.length) return
    html += `<div class="tech-group"><div class="tech-group-title">${g.name}</div><div class="stats-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">`
    g.items.forEach(item => {
      html += `<div class="stat-item"><span class="stat-label">${item.label}</span><span class="stat-value ${item.cls || ''}">${item.value || '—'}</span></div>`
    })
    html += '</div></div>'
  })

  if (!html) html = '<div class="empty-msg">No data for selected indicators</div>'

  // Reference section
  const activeRefs = []
  const chipIds = ['tech-sma','tech-ema','tech-macd','tech-adx','tech-rsi','tech-stoch','tech-wr','tech-cci','tech-mfi','tech-roc','tech-mom','tech-bb','tech-atr','tech-obv']
  const refKeys = ['sma','ema','macd','adx','rsi','stoch','wr','cci','mfi','roc','mom','bb','atr','obv']
  chipIds.forEach((id, i) => {
    const el = document.getElementById(id)
    if (el?.checked && TECH_REFS[refKeys[i]]) {
      activeRefs.push({ label: el.parentElement.querySelector('.tech-chip-label')?.textContent || refKeys[i].toUpperCase(), desc: TECH_REFS[refKeys[i]] })
    }
  })
  if (activeRefs.length) {
    html += `<details class="tech-refs" style="margin-top:16px"><summary style="cursor:pointer;font-size:12px;font-weight:600;color:var(--text-secondary)">📖 Indicator Guide (${activeRefs.length})</summary><div class="tech-refs-grid">`
    activeRefs.forEach(r => {
      html += `<div class="tech-ref-item"><strong>${r.label}</strong><span>${r.desc}</span></div>`
    })
    html += '</div></details>'
  }

  container.innerHTML = html
  maybeShowTechAskAI()
}



let mcpConfig = null
const MCP_CONFIG_KEY = 'mcp_config'
const MCP_SESSION_KEY = 'mcp_session_id'
const MCP_CONFIG_DEFAULTS = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: 'You are a helpful NSE stock market assistant. Provide concise, data-driven answers. Use markdown for formatting. Cite your sources.',
}

function loadMCPConfig() {
  try {
    const saved = localStorage.getItem(MCP_CONFIG_KEY)
    if (saved) { mcpConfig = { ...MCP_CONFIG_DEFAULTS, ...JSON.parse(saved) }; return }
  } catch {}
  mcpConfig = { ...MCP_CONFIG_DEFAULTS }
}
loadMCPConfig()

function saveMCPConfig() {
  localStorage.setItem(MCP_CONFIG_KEY, JSON.stringify(mcpConfig))
}

// Session state
let mcpCurrentSessionId = null
let mcpPollInterval = null
let mcpExpiryInterval = null

async function sendMCPQuery({ regenerate } = {}) {
  const queryInput = document.getElementById('mcp-query-input')
  const responseEl = document.getElementById('mcp-response')
  const sendBtn = document.getElementById('mcp-send')
  const regenerateBtn = document.getElementById('mcp-regenerate')
  const costBanner = document.getElementById('mcp-cost-banner')
  const rateLimitEl = document.getElementById('mcp-rate-limit')
  const usageStatsEl = document.getElementById('mcp-usage-stats')

  const query = queryInput.value.trim()
  if (!query && !regenerate) return

  sendBtn.disabled = true
  regenerateBtn.style.display = 'none'

  // Show loading with elapsed timer
  const startTime = Date.now()
  responseEl.innerHTML = '<div class="loading-msg"><span class="spinner"></span>Thinking... (0.0s)</div>'
  const timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const loadingEl = responseEl.querySelector('.loading-msg')
    if (loadingEl) loadingEl.innerHTML = `<span class="spinner"></span>Thinking... (${elapsed}s)`
  }, 100)

  // Build request
  const sessionId = localStorage.getItem(MCP_SESSION_KEY) || null

  const body = {
    model: mcpConfig.model,
    temperature: mcpConfig.temperature,
    maxTokens: mcpConfig.maxTokens,
    systemPrompt: mcpConfig.systemPrompt,
  }
  if (!regenerate) body.query = query
  if (sessionId) body.sessionId = sessionId

  try {
    const res = await apiFetch('/api/mcp/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    // Save session
    if (res?.sessionId) {
      localStorage.setItem(MCP_SESSION_KEY, res.sessionId)
      renderMCPSessionBar(res.sessionId, res)
    }

    // Render response
    renderMCPResponse(res)

    // Cost banner
    if (res?.cost != null) {
      const cost = typeof res.cost === 'number' ? `$${res.cost.toFixed(6)}` : res.cost
      costBanner.innerHTML = `💰 Approx cost: ${cost}`
      costBanner.style.display = 'flex'
    } else {
      costBanner.style.display = 'none'
    }

    // Rate limit
    if (res?.rateLimit) {
      const rl = res.rateLimit
      rateLimitEl.textContent = `Rate: ${rl.remaining || 0}/${rl.limit || '?'} remaining · Resets ${rl.reset ? new Date(rl.reset * 1000).toLocaleTimeString() : '—'}`
      rateLimitEl.style.display = 'block'
    } else {
      rateLimitEl.style.display = 'none'
    }

    // Usage stats + response time
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    if (res?.usage) {
      const u = res.usage
      usageStatsEl.innerHTML = `Tokens: ${u.promptTokens || 0}↑ / ${u.completionTokens || 0}↓ (total ${u.totalTokens || 0}) · Response in ${elapsed}s`
      usageStatsEl.style.display = 'block'
    } else {
      usageStatsEl.innerHTML = `Response in ${elapsed}s`
      usageStatsEl.style.display = 'block'
    }

    // Show regenerate + export + clear
    regenerateBtn.style.display = 'inline-block'
    document.getElementById('mcp-clear').style.display = 'inline-block'
    document.getElementById('mcp-export').style.display = 'inline-block'

  } catch (err) {
    renderMCPError(err)
  } finally {
    clearInterval(timerInterval)
    sendBtn.disabled = false
  }
}

function renderMCPResponse(res) {
  const responseEl = document.getElementById('mcp-response')
  const content = res?.content || res?.response || res?.message || ''
  if (!content) {
    responseEl.innerHTML = '<div class="empty-msg">No response from AI</div>'
    return
  }
  // Markdown render with XSS protection
  let html
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      html = marked.parse(content)
      html = DOMPurify.sanitize(html)
    } else {
      html = '<pre style="white-space:pre-wrap">' + escapeHtml(content) + '</pre>'
    }
  } catch {
    html = '<pre style="white-space:pre-wrap">' + escapeHtml(content) + '</pre>'
  }
  responseEl.innerHTML = html
}

function renderMCPError(err) {
  const responseEl = document.getElementById('mcp-response')
  const msg = err?.message || String(err) || 'Unknown error'
  let displayMsg = msg
  let retry = true

  if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('API key')) {
    displayMsg = '❌ OpenAI API key error. Please check your OPENAI_API_KEY in .env and restart the server.'
    retry = false
  } else if (msg.includes('429') || msg.includes('rate limit')) {
    displayMsg = '⏳ Rate limited. Please wait before sending another query.'
    retry = true
  } else if (msg.includes('500') || msg.includes('server error') || msg.includes('Internal Server Error')) {
    displayMsg = '⚠️ Server error. The backend may be down or misconfigured.'
    retry = true
  } else if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('abort')) {
    displayMsg = '⏰ Request timed out. The AI took too long to respond. Try a simpler question.'
    retry = true
  } else if (msg.includes('502') || msg.includes('503') || msg.includes('Bad Gateway') || msg.includes('Service Unavailable') || msg.includes('gateway')) {
    displayMsg = '⚠️ Gateway error (502/503). The upstream API may be temporarily unavailable. Please try again shortly.'
    retry = true
  }

  responseEl.innerHTML = `<div class="error-banner">${escapeHtml(displayMsg)}${retry ? '<button class="btn btn-sm" onclick="sendMCPQuery({regenerate:true})">Retry</button>' : ''}</div>`
}

function exportMCPResponse() {
  const container = document.getElementById('mcp-response')
  if (!container) return
  const text = container.textContent || container.innerText || ''
  download(text.trim() || 'No response content', 'mcp-response', 'text/plain;charset=utf-8')
}

function renderMCPSessionBar(sessionId, data) {
  const bar = document.getElementById('mcp-session-bar')
  const labelEl = document.getElementById('mcp-session-label')
  const statsEl = document.getElementById('mcp-context-stats')

  mcpCurrentSessionId = sessionId
  bar.style.display = 'flex'
  labelEl.textContent = `Session: ${sessionId.slice(0, 12)}...`

  if (data?.contextStats) {
    const s = data.contextStats
    statsEl.textContent = `Messages: ${s.messages || 0} · Tokens: ${s.tokens || 0}`
  } else {
    statsEl.textContent = ''
  }

  if (data?.expiresAt) {
    startMCPExpiryCountdown(data.expiresAt)
  }

  startMCPContextPolling(sessionId)
}

function startMCPContextPolling(sessionId) {
  stopMCPContextPolling()
  const pollFn = async () => {
    try {
      const data = await apiFetch(`/api/mcp/session/${sessionId}`)
      if (data?.contextStats) {
        const s = data.contextStats
        document.getElementById('mcp-context-stats').textContent = `Messages: ${s.messages || 0} · Tokens: ${s.tokens || 0}`
      }
    } catch {
      // session may be gone
    }
  }
  pollFn()
  mcpPollInterval = setInterval(pollFn, 10000)
  intervalIds.push(mcpPollInterval)
}

function stopMCPContextPolling() {
  if (mcpPollInterval) {
    clearInterval(mcpPollInterval)
    mcpPollInterval = null
  }
}

function startMCPExpiryCountdown(expiresAt) {
  stopMCPExpiryCountdown()
  const expiryEl = document.getElementById('mcp-session-expiry')
  function tick() {
    const now = Date.now()
    const exp = new Date(expiresAt).getTime()
    const diff = exp - now
    if (diff <= 0) {
      expiryEl.textContent = 'Expired'
      document.getElementById('mcp-session-bar').style.display = 'none'
      stopMCPExpiryCountdown()
      stopMCPContextPolling()
      localStorage.removeItem(MCP_SESSION_KEY)
      mcpCurrentSessionId = null
      return
    }
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    expiryEl.textContent = `Expires in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  tick()
  mcpExpiryInterval = setInterval(tick, 1000)
  intervalIds.push(mcpExpiryInterval)
}

function stopMCPExpiryCountdown() {
  if (mcpExpiryInterval) {
    clearInterval(mcpExpiryInterval)
    mcpExpiryInterval = null
  }
}

function updateMCPPolling() {
  if (!mcpCurrentSessionId) {
    stopMCPContextPolling()
    return
  }
  const mcpTab = document.getElementById('tab-mcp')
  const isActive = mcpTab && mcpTab.classList.contains('active')
  const isVisible = !document.hidden
  if (isActive && isVisible) {
    if (!mcpPollInterval) {
      startMCPContextPolling(mcpCurrentSessionId)
    }
  } else {
    stopMCPContextPolling()
  }
}

async function validateMCPRestore(sessionId) {
  try {
    const data = await apiFetch(`/api/mcp/session/${sessionId}`)
    renderMCPSessionBar(sessionId, data)
  } catch {
    localStorage.removeItem(MCP_SESSION_KEY)
    document.getElementById('mcp-session-bar').style.display = 'none'
  }
}

async function loadMCPSessions() {
  const container = document.getElementById('mcp-sessions-list')
  try {
    const data = await apiFetch('/api/mcp/sessions')
    const sessions = data?.sessions || data || []
    renderMCPSessions(sessions)
  } catch {
    container.innerHTML = '<div class="empty-msg">Failed to load sessions</div>'
  }
}

function renderMCPSessions(sessions) {
  const container = document.getElementById('mcp-sessions-list')
  if (!sessions.length) {
    container.innerHTML = '<div class="empty-msg">No past sessions</div>'
    return
  }
  container.innerHTML = sessions.map(s => {
    const sid = s.sessionId || s.id || ''
    const isActive = sid === mcpCurrentSessionId
    const msgCount = s.messageCount || s.contextStats?.messages || 0
    const lastUsed = s.lastUsed || s.updatedAt || s.createdAt
    const relTime = lastUsed ? formatRelativeTime(lastUsed) : '—'
    return `<div class="mcp-session-item ${isActive ? 'active' : ''}">
      <div class="mcp-session-item-info">
        <span class="mcp-session-item-id">${escapeHtml(sid.slice(0, 12))}...</span>
        <span class="mcp-session-item-meta">${msgCount} msgs · ${relTime}</span>
      </div>
      <div class="mcp-session-item-actions">
        <button class="btn btn-sm mcp-session-load" data-sid="${sid}">Load</button>
        <button class="btn btn-sm mcp-session-delete" data-sid="${sid}">Delete</button>
      </div>
    </div>`
  }).join('')
  container.querySelectorAll('.mcp-session-load').forEach(btn => {
    btn.addEventListener('click', () => loadMCPSession(btn.dataset.sid))
  })
  container.querySelectorAll('.mcp-session-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this session?')) return
      await deleteMCPSession(btn.dataset.sid)
    })
  })
}

function formatRelativeTime(dateVal) {
  const date = dateVal instanceof Date ? dateVal : new Date(dateVal)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

async function loadMCPSession(sessionId) {
  localStorage.setItem(MCP_SESSION_KEY, sessionId)
  document.getElementById('mcp-response').innerHTML = '<div class="loading-msg"><span class="spinner"></span>Loading session...</div>'
  await sendMCPQuery({ regenerate: true })
  loadMCPSessions()
}

async function deleteMCPSession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/api/mcp/session/${sessionId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    loadMCPSessions()
    if (sessionId === mcpCurrentSessionId || sessionId === localStorage.getItem(MCP_SESSION_KEY)) {
      localStorage.removeItem(MCP_SESSION_KEY)
      mcpCurrentSessionId = null
      document.getElementById('mcp-session-bar').style.display = 'none'
      stopMCPContextPolling()
      stopMCPExpiryCountdown()
    }
  } catch (err) {
    alert('Failed to delete session: ' + (err.message || 'Unknown error'))
  }
}

let mcpToolsCache = null
let mcpToolsCacheTimestamp = null

function formatMCPParams(params) {
  if (!params || !Object.keys(params).length) return '—'
  // JSON Schema format: { type:'object', properties:{...}, required:[...] }
  if (params.properties && typeof params.properties === 'object') {
    const required = params.required || []
    return Object.entries(params.properties).map(([k, v]) => {
      const type = v.type || 'any'
      const req = required.includes(k) ? ' *required*' : ''
      return `<code>${escapeHtml(k)}</code>: <em>${escapeHtml(type)}</em>${req}`
    }).join('<br>')
  }
  // Direct format: { paramName: { type:'string', required:true, ... } }
  return Object.entries(params).map(([k, v]) => {
    const type = (v && v.type) || 'any'
    const req = (v && v.required) ? ' *required*' : ''
    return `<code>${escapeHtml(k)}</code>: <em>${escapeHtml(type)}</em>${req}`
  }).join('<br>')
}

async function loadMCPTools() {
  const container = document.getElementById('mcp-tools-content')
  const pagination = document.getElementById('mcp-tools-pagination')

  // Check 1-hour cache expiry
  if (mcpToolsCache && mcpToolsCacheTimestamp && (Date.now() - mcpToolsCacheTimestamp) > 3600000) {
    mcpToolsCache = null
    mcpToolsCacheTimestamp = null
  }

  if (mcpToolsCache) {
    renderMCPTools(mcpToolsCache)
    return
  }

  container.innerHTML = '<div class="loading-msg"><span class="spinner"></span>Loading tools...</div>'

  try {
    const data = await apiFetch('/api/mcp/tools')
    let tools = data?.tools || data || []
    tools.sort((a, b) => (a.name || a.function?.name || '').localeCompare(b.name || b.function?.name || ''))
    mcpToolsCache = tools
    mcpToolsCacheTimestamp = Date.now()
    renderMCPTools(tools)
  } catch (err) {
    container.innerHTML = '<div class="empty-msg">Failed to load tools</div>'
  }
}

function renderMCPTools(tools) {
  const container = document.getElementById('mcp-tools-content')
  const pagination = document.getElementById('mcp-tools-pagination')
  const filterInput = document.getElementById('mcp-tools-filter')
  const countBadge = document.getElementById('mcp-tools-count')
  const timestampEl = document.getElementById('mcp-tools-timestamp')

  // Update tool count badge
  if (countBadge) countBadge.textContent = tools.length ? `${tools.length} tool${tools.length !== 1 ? 's' : ''}` : ''

  // Update cache timestamp
  if (timestampEl && mcpToolsCacheTimestamp) {
    const seconds = Math.floor((Date.now() - mcpToolsCacheTimestamp) / 1000)
    let relTime
    if (seconds < 60) relTime = 'just now'
    else if (seconds < 3600) relTime = `${Math.floor(seconds / 60)} min ago`
    else relTime = `${Math.floor(seconds / 3600)}h ago`
    timestampEl.textContent = `Cached: ${relTime}`
  }

  if (!tools.length) {
    container.innerHTML = '<div class="empty-msg">No tools available</div>'
    pagination.style.display = 'none'
    return
  }

  const PAGE_SIZE = 10
  let currentPage = 1
  let filtered = [...tools]

  function renderPage() {
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1
    if (currentPage > totalPages) currentPage = totalPages
    const start = (currentPage - 1) * PAGE_SIZE
    const page = filtered.slice(start, start + PAGE_SIZE)

    let html = '<div class="mcp-tools-table table-wrap"><table><thead><tr><th>Tool</th><th>Description</th><th>Parameters</th></tr></thead><tbody>'
    page.forEach(t => {
      const params = t.parameters || t.params || {}
      const paramStr = formatMCPParams(params)
      html += `<tr><td><strong>${escapeHtml(t.name || t.function?.name || '—')}</strong></td>
        <td>${escapeHtml(t.description || t.function?.description || '')}</td>
        <td style="font-size:11px">${paramStr}</td></tr>`
    })
    html += '</tbody></table></div>'
    html += `<p class="row-count">${filtered.length} tool${filtered.length !== 1 ? 's' : ''} · showing ${start + 1}-${Math.min(start + PAGE_SIZE, filtered.length)}</p>`
    container.innerHTML = html

    // Pagination
    if (totalPages > 1) {
      let p = ''
      p += `<button class="btn btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="mcpToolsPage(${currentPage - 1})" aria-label="Previous page">← Prev</button>`
      p += `<span>Page ${currentPage} of ${totalPages}</span>`
      p += `<button class="btn btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="mcpToolsPage(${currentPage + 1})" aria-label="Next page">Next →</button>`
      pagination.innerHTML = p
      pagination.style.display = 'flex'
    } else {
      pagination.style.display = 'none'
    }
  }

  // Expose pagination function globally
  window.mcpToolsPage = (page) => {
    currentPage = page
    renderPage()
  }

  // Filter (only set up once to avoid duplicate listeners)
  if (!filterInput.dataset.mcpFilterReady) {
    filterInput.dataset.mcpFilterReady = 'true'
    filterInput.addEventListener('input', function() {
      const q = this.value.toLowerCase()
      filtered = tools.filter(t => {
        const name = (t.name || t.function?.name || '').toLowerCase()
        const desc = (t.description || t.function?.description || '').toLowerCase()
        return name.includes(q) || desc.includes(q)
      })
      currentPage = 1
      renderPage()
    })
  }

  renderPage()
}

async function testMCPConnection() {
  const btn = document.getElementById('mcp-test-config')
  const msgEl = document.getElementById('mcp-status-msg')
  btn.disabled = true
  msgEl.textContent = 'Testing...'

  try {
    const data = await apiFetch('/api/mcp/test')
    if (data?.status === 'ok') {
      msgEl.textContent = `✓ Connected ${data.openaiConfigured ? '(API key configured)' : '(no API key — queries will fail)'}`
    } else {
      msgEl.textContent = `⚠ ${data?.error || 'Unexpected response'}`
    }
  } catch (err) {
    msgEl.textContent = `✗ ${err?.message || 'Connection failed'}`
  } finally {
    btn.disabled = false
    setTimeout(() => { msgEl.textContent = '' }, 5000)
  }
}

// ── Cross-tab "Ask AI" helper ────────────────────────────
// ── MCP Initialization ─────────────────────────────────────
function initMCPTab() {
  // API key check
  const warningEl = document.getElementById('mcp-api-key-warning')
  apiFetch('/api/mcp/test').then(data => {
    if (warningEl) warningEl.style.display = (data?.status === 'ok' || data?.openaiConfigured) ? 'none' : 'flex'
  }).catch(() => {
    if (warningEl) warningEl.style.display = 'flex'
  })

  // Restore session from localStorage if valid
  const storedSession = localStorage.getItem(MCP_SESSION_KEY)
  if (storedSession) {
    mcpCurrentSessionId = storedSession
    validateMCPRestore(storedSession)
  }

  // Load config into UI
  document.getElementById('mcp-config-model').value = mcpConfig.model
  document.getElementById('mcp-config-temp').value = mcpConfig.temperature
  document.getElementById('mcp-temp-value').textContent = mcpConfig.temperature
  document.getElementById('mcp-config-max-tokens').value = mcpConfig.maxTokens
  document.getElementById('mcp-config-system-prompt').value = mcpConfig.systemPrompt

  // Temperature slider live update
  document.getElementById('mcp-config-temp').addEventListener('input', function() {
    document.getElementById('mcp-temp-value').textContent = this.value
  })

  // Query input handlers
  const queryInput = document.getElementById('mcp-query-input')
  document.getElementById('mcp-send').addEventListener('click', () => sendMCPQuery())
  queryInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMCPQuery() }
  })
  // Word/char counter
  queryInput.addEventListener('input', function() {
    const text = this.value.trim()
    const words = text ? text.split(/\s+/).length : 0
    const chars = this.value.length
    const counter = document.getElementById('mcp-counter')
    if (counter) counter.textContent = `${words} words | ${chars} chars`
  })

  // Regenerate, Clear, Export
  document.getElementById('mcp-regenerate').addEventListener('click', () => sendMCPQuery({ regenerate: true }))
  document.getElementById('mcp-clear').addEventListener('click', () => {
    document.getElementById('mcp-response').innerHTML = '<div class="empty-msg">Ask a question to get started</div>'
    document.getElementById('mcp-usage-stats').style.display = 'none'
    document.getElementById('mcp-regenerate').style.display = 'none'
    document.getElementById('mcp-clear').style.display = 'none'
    document.getElementById('mcp-export').style.display = 'none'
    document.getElementById('mcp-cost-banner').style.display = 'none'
    document.getElementById('mcp-rate-limit').style.display = 'none'
    queryInput.value = ''
    queryInput.focus()
  })

  // Config save
  document.getElementById('mcp-save-config').addEventListener('click', () => {
    mcpConfig.model = document.getElementById('mcp-config-model').value
    mcpConfig.temperature = parseFloat(document.getElementById('mcp-config-temp').value)
    mcpConfig.maxTokens = parseInt(document.getElementById('mcp-config-max-tokens').value, 10) || 1024
    mcpConfig.systemPrompt = document.getElementById('mcp-config-system-prompt').value
    saveMCPConfig()
    document.getElementById('mcp-status-msg').textContent = '✓ Config saved'
    setTimeout(() => { document.getElementById('mcp-status-msg').textContent = '' }, 2000)
  })

  // Config reset
  document.getElementById('mcp-reset-config').addEventListener('click', () => {
    mcpConfig = { ...MCP_CONFIG_DEFAULTS }
    saveMCPConfig()
    document.getElementById('mcp-config-model').value = mcpConfig.model
    document.getElementById('mcp-config-temp').value = mcpConfig.temperature
    document.getElementById('mcp-temp-value').textContent = mcpConfig.temperature
    document.getElementById('mcp-config-max-tokens').value = mcpConfig.maxTokens
    document.getElementById('mcp-config-system-prompt').value = mcpConfig.systemPrompt
    document.getElementById('mcp-status-msg').textContent = '✓ Config reset to defaults'
    setTimeout(() => { document.getElementById('mcp-status-msg').textContent = '' }, 2000)
  })

  // Test connection
  document.getElementById('mcp-test-config').addEventListener('click', testMCPConnection)

  // Debug toggle
  document.getElementById('mcp-debug-toggle').addEventListener('change', async function() {
    try {
      const res = await apiFetch('/api/mcp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debugLogging: this.checked })
      })
      const msg = res?.restartRequired 
        ? 'Setting will take effect on next server restart' 
        : 'Debug logging ' + (this.checked ? 'enabled' : 'disabled')
      document.getElementById('mcp-status-msg').textContent = msg
      setTimeout(() => { document.getElementById('mcp-status-msg').textContent = '' }, 4000)
    } catch {
      document.getElementById('mcp-status-msg').textContent = 'Failed to update debug setting'
      setTimeout(() => { document.getElementById('mcp-status-msg').textContent = '' }, 3000)
    }
  })

  // New session
  document.getElementById('mcp-new-session').addEventListener('click', () => {
    localStorage.removeItem(MCP_SESSION_KEY)
    document.getElementById('mcp-response').innerHTML = '<div class="empty-msg">New session started. Ask a question!</div>'
    document.getElementById('mcp-session-bar').style.display = 'none'
    document.getElementById('mcp-usage-stats').style.display = 'none'
    document.getElementById('mcp-cost-banner').style.display = 'none'
    document.getElementById('mcp-rate-limit').style.display = 'none'
    document.getElementById('mcp-regenerate').style.display = 'none'
    document.getElementById('mcp-clear').style.display = 'none'
    document.getElementById('mcp-export').style.display = 'none'
    queryInput.value = ''
    queryInput.focus()
    stopMCPContextPolling()
    stopMCPExpiryCountdown()
    mcpCurrentSessionId = null
  })

  // Ctrl+S to save config when in system prompt
  document.getElementById('mcp-config-system-prompt').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      document.getElementById('mcp-save-config').click()
    }
  })

  // Visibility + tab change for polling
  document.addEventListener('visibilitychange', updateMCPPolling)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateMCPPolling, 100))
  })
}

function switchToMCPTab(question) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  document.querySelector('.tab-btn[data-tab="tab-mcp"]')?.classList.add('active')
  document.getElementById('tab-mcp')?.classList.add('active')
  const input = document.getElementById('mcp-query-input')
  if (input) {
    input.value = question
    document.getElementById('mcp-send')?.click()
  }
}

function askAIAboutStock() {
  const symbol = document.getElementById('stock-symbol')?.value?.trim()?.toUpperCase()
  if (!symbol) return
  switchToMCPTab(`Analyze ${symbol}: summarize key financials, recent price action, and any notable signals or risks based on available NSE data.`)
}

function askAIAboutTechnical() {
  const symbol = document.getElementById('tech-symbol')?.value?.trim()?.toUpperCase()
  if (!symbol) return
  switchToMCPTab(`Interpret the technical indicators for ${symbol}: identify the trend, momentum signals, overbought/oversold conditions, and suggest a short-term outlook.`)
}

// Show/hide "Ask AI" buttons when data loads — hook into existing render functions
function maybeShowStockAskAI() {
  const btn = document.getElementById('stock-ask-ai')
  const detailsEl = document.getElementById('stock-details')
  if (btn && detailsEl && !detailsEl.classList.contains('empty-msg') && detailsEl.innerHTML.trim()) {
    btn.style.display = 'inline-block'
  }
}
function maybeShowTechAskAI() {
  const bar = document.getElementById('tech-ask-ai-bar')
  const techEl = document.getElementById('tech-result')
  if (bar && techEl && !techEl.classList.contains('empty-msg') && techEl.innerHTML.trim()) {
    bar.style.display = 'block'
  }
}


// ── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTabs()

  const statusEl = document.getElementById('server-status')

  // Auto-detect API server port
  statusEl.textContent = 'Probing ports...'
  await findApiBase()

  try {
    const status = await apiFetch('/api/marketStatus')
    statusEl.textContent = `✓ Connected ${API_BASE || '(same origin)'}`
    statusEl.className = 'header-status'
  } catch (err) {
    const tip = API_BASE ? `at ${API_BASE}` : '(same origin)'
    statusEl.textContent = '✗ Cannot reach server'
    statusEl.className = 'header-status error'
    showError('main-content', new Error(
      `Cannot reach API server ${tip}. ` +
      `Make sure the server is running (npm start) and CORS_ORIGINS is set.`
    ))
    return
  }

  // Load symbols in background for autocomplete
  loadSymbols().catch(() => {})

  // Load index names in background
  loadIndexNames().then(populateIndexSelect).catch(() => {})

  // Init all tabs
  initMarketTab()
  initStockTab()
  initIndicesTab()
  initOptionsTab()
  initChartsTab()
  initTechnicalTab()
  initMCPTab()

  // Load MCP tools and session list on first visit to tab
  document.querySelector('.tab-btn[data-tab="tab-mcp"]')?.addEventListener('click', () => {
    loadMCPTools()
    loadMCPSessions()
  }, { once: true })

  window.addEventListener('unhandledrejection', event => {
    showError('mo-key-indices', event.reason)
  })

  window.addEventListener('beforeunload', () => {
    intervalIds.forEach(id => clearInterval(id))
  })
})
