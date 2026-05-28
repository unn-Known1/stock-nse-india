// ═══════════════════════════════════════════════════════════
// NSE India Data Explorer — App Logic
// ═══════════════════════════════════════════════════════════

// ── Configuration (port auto-detection) ───────────────────
// Probes common ports at startup to find the API server.
// Dashboard works with: same origin, localhost:3000-3003, or manual API_BASE override.
const PROBE_PORTS = ['', '3000', '3001', '3002', '3003']
let API_BASE = ''

async function findApiBase() {
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
        console.log(`API server found at ${API_BASE || 'same origin'}`)
        return true
      }
    } catch {
      // port not responding, try next
    }
  }

  // Fallback: assume same origin
  API_BASE = ''
  console.warn('API server not found on probed ports, using same origin')
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
}

function invalidateCache(url) { cache.delete(url) }
function clearAllCache() { cache.clear() }

// ── API Fetch ──────────────────────────────────────────────
async function apiFetch(url) {
  const cached = cacheGet(url)
  if (cached) return cached

  const res = await fetch(`${API_BASE}${url}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}${text ? ': ' + text.replace(/\[NSE API\]/g, 'NSE') : ''}`)
  }
  const data = await res.json()
  cacheSet(url, data)
  return data
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
  if (!container?.dataset.fullData) return
  const raw = JSON.parse(container.dataset.fullData)
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
  if (!container?.dataset.fullData) return
  download(container.dataset.fullData, `${filename}.json`, 'application/json')
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
      `<div class="suggestion" data-idx="${i}" data-value="${s}">${s}</div>`
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
const MARKET_ENDPOINTS = [
  { id: 'mo-status',     url: '/api/marketStatus',      name: 'Market Status' },
  { id: 'mo-turnover',   url: '/api/marketTurnover',    name: 'Market Turnover' },
  { id: 'mo-indices',    url: '/api/allIndices',        name: 'All Indices' },
  { id: 'mo-holidays-t', url: '/api/holidays?type=trading', name: 'Trading Holidays' },
  { id: 'mo-holidays-c', url: '/api/holidays?type=clearing', name: 'Clearing Holidays' },
  { id: 'mo-glossary',   url: '/api/glossary',          name: 'Glossary' },
]

function initMarketTab() {
  document.getElementById('mo-refresh')?.addEventListener('click', () => {
    MARKET_ENDPOINTS.forEach(ep => invalidateCache(ep.url))
    loadMarketData()
  })

  loadMarketData()
}

async function loadMarketData() {
  MARKET_ENDPOINTS.forEach(ep => showLoading(ep.id, 'Loading...'))

  const results = await Promise.allSettled(
    MARKET_ENDPOINTS.map(ep => apiFetch(ep.url).then(data => ({ ...ep, data })))
  )

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      renderTable(r.value.data, r.value.id)
    } else {
      showError(r.value?.id || 'mo-status', r.reason,
        () => apiFetch(r.value?.url).then(d => renderTable(d, r.value?.id)).catch(e => showError(r.value?.id, e))
      )
    }
  })
}

// ── Stock Lookup Tab ────────────────────────────────────────
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

async function loadStockData(symbol) {
  if (!symbol) return
  const sections = [
    { id: 'stock-details',   url: `/api/equity/${symbol}`,              name: 'Details' },
    { id: 'stock-trade',     url: `/api/equity/tradeInfo/${symbol}`,     name: 'Trade Info' },
    { id: 'stock-intraday',  url: `/api/equity/intraday/${symbol}`,      name: 'Intraday' },
  ]

  sections.forEach(s => showLoading(s.id, 'Loading...'))

  const results = await Promise.allSettled(
    sections.map(s => apiFetch(s.url).then(data => ({ ...s, data })))
  )

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      renderTable(r.value.data, r.value.id)
    } else {
      showError(r.status, r.reason,
        () => apiFetch(r.value?.url).then(d => renderTable(d, r.value?.id)).catch(e => showError(r.value?.id, e))
      )
    }
  })
}

// ── Indices Tab ─────────────────────────────────────────────
let indexNamesCache = []

async function loadIndexNames() {
  if (indexNamesCache.length) return
  indexNamesCache = await apiFetch('/api/indexNames')
}

function populateIndexSelect() {
  const sel = document.getElementById('index-select')
  if (!sel || !indexNamesCache.length) return
  sel.innerHTML = '<option value="">Select index...</option>' +
    indexNamesCache.map(i => `<option value="${i.key}">${i.index || i.key}</option>`).join('')
}

function initIndicesTab() {
  showLoading('index-loading', 'Loading indices...')
  loadIndexNames().then(() => {
    populateIndexSelect()
    document.getElementById('index-loading').innerHTML = ''
  }).catch(err => showError('index-loading', err))

  document.getElementById('index-go')?.addEventListener('click', () => {
    const sel = document.getElementById('index-select')
    if (sel?.value) loadIndexData(sel.value)
  })
}

async function loadIndexData(indexKey) {
  const sections = [
    { id: 'index-stocks',   url: `/api/index/${indexKey}`,              name: 'Constituent Stocks' },
    { id: 'index-gl',       url: `/api/gainersAndLosers/${indexKey}`,    name: 'Gainers & Losers' },
    { id: 'index-active',   url: `/api/mostActive/${indexKey}`,          name: 'Most Active' },
  ]

  sections.forEach(s => showLoading(s.id, 'Loading...'))

  const results = await Promise.allSettled(
    sections.map(s => apiFetch(s.url).then(data => ({ ...s, data })))
  )

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      renderTable(r.value.data, r.value.id)
    } else {
      showError(r.status, r.reason,
        () => apiFetch(r.value?.url).then(d => renderTable(d, r.value?.id)).catch(e => showError(r.value?.id, e))
      )
    }
  })
}

// ── Options Tab ─────────────────────────────────────────────
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
  showLoading(id, 'Loading option chain...')
  try {
    const data = await apiFetch(url)
    renderTable(data, id)
  } catch (err) {
    showError(id, err, () => loadOptionsData(type, key))
  }
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
  showLoading(id, 'Loading chart data...')
  try {
    const data = await apiFetch(`/api/charts/equity-historical-data?symbol=${symbol}&chartType=${chartType}&timeInterval=${interval}`)
    renderTable(data, id)
  } catch (err) {
    showError(id, err, () => loadChartData(symbol))
  }
}

// ── Technical Tab ───────────────────────────────────────────
function initTechnicalTab() {
  setupAutocomplete('tech-symbol', 'tech-suggestions')

  document.getElementById('tech-go')?.addEventListener('click', () => {
    const symbol = document.getElementById('tech-symbol')?.value.trim().toUpperCase()
    if (symbol) loadTechnicalData(symbol)
  })
}

async function loadTechnicalData(symbol) {
  const period = document.getElementById('tech-period')?.value || 200
  const showLatest = document.getElementById('tech-latest')?.checked !== false

  const collects = {
    smaEnabled: document.getElementById('tech-sma')?.checked,
    emaEnabled: document.getElementById('tech-ema')?.checked,
    rsiEnabled: document.getElementById('tech-rsi')?.checked,
    bbEnabled: document.getElementById('tech-bb')?.checked,
    macdEnabled: document.getElementById('tech-macd')?.checked,
    stochEnabled: document.getElementById('tech-stoch')?.checked,
    williamsREnabled: document.getElementById('tech-wr')?.checked,
    atrEnabled: document.getElementById('tech-atr')?.checked,
    adxEnabled: document.getElementById('tech-adx')?.checked,
    obvEnabled: document.getElementById('tech-obv')?.checked,
    cciEnabled: document.getElementById('tech-cci')?.checked,
    mfiEnabled: document.getElementById('tech-mfi')?.checked,
    rocEnabled: document.getElementById('tech-roc')?.checked,
    momentumEnabled: document.getElementById('tech-mom')?.checked,
    period,
    showOnlyLatest: showLatest,
  }

  const params = new URLSearchParams()
  params.set('period', period)
  if (collects.smaEnabled) params.set('smaPeriods', document.getElementById('tech-sma-p')?.value || '5,10,20,50,100,200')
  if (collects.emaEnabled) params.set('emaPeriods', document.getElementById('tech-ema-p')?.value || '5,10,20,50,100,200')
  if (collects.rsiEnabled) params.set('rsiPeriod', document.getElementById('tech-rsi-p')?.value || 14)
  if (collects.bbEnabled) { params.set('bbPeriod', document.getElementById('tech-bb-p')?.value || 20); params.set('bbStdDev', document.getElementById('tech-bb-s')?.value || 2) }
  if (collects.macdEnabled) { params.set('macdFast', document.getElementById('tech-macd-f')?.value || 12); params.set('macdSlow', document.getElementById('tech-macd-s')?.value || 26); params.set('macdSignal', document.getElementById('tech-macd-m')?.value || 9) }
  if (collects.stochEnabled) { params.set('stochK', document.getElementById('tech-stoch-k')?.value || 14); params.set('stochD', document.getElementById('tech-stoch-d')?.value || 3) }
  if (collects.williamsREnabled) params.set('williamsRPeriod', document.getElementById('tech-wr-p')?.value || 14)
  if (collects.atrEnabled) params.set('atrPeriod', document.getElementById('tech-atr-p')?.value || 14)
  if (collects.adxEnabled) params.set('adxPeriod', document.getElementById('tech-adx-p')?.value || 14)
  if (collects.cciEnabled) params.set('cciPeriod', document.getElementById('tech-cci-p')?.value || 20)
  if (collects.mfiEnabled) params.set('mfiPeriod', document.getElementById('tech-mfi-p')?.value || 14)
  if (collects.rocEnabled) params.set('rocPeriod', document.getElementById('tech-roc-p')?.value || 10)
  if (collects.momentumEnabled) params.set('momentumPeriod', document.getElementById('tech-mom-p')?.value || 10)
  if (collects.showOnlyLatest !== undefined) params.set('showOnlyLatest', showLatest)

  const id = 'tech-result'
  showLoading(id, 'Calculating technical indicators...')
  try {
    const data = await apiFetch(`/api/equity/technicalIndicators/${symbol}?${params.toString()}`)
    renderTable(data, id)
  } catch (err) {
    showError(id, err, () => loadTechnicalData(symbol))
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
})
