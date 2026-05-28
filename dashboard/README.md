# NSE India Data Explorer — Dashboard

A browser-based dashboard for the [stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) API server. No build step, no dependencies — just open it.

## Quick Start

```bash
# Terminal 1 — start the API server
cd stock-nse-india
npm start

# Terminal 2 — serve the dashboard
npx serve dashboard
```

Open the URL `serve` gives you (usually `http://localhost:3000`). The dashboard auto-detects the API server port by probing `3000`–`3003`.

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Market Overview** | Market status, turnover, all indices, trading/clearing holidays, glossary |
| **Stock Lookup** | Equity details, trade info, intraday data — pick a symbol via autocomplete |
| **Indices** | Index constituents, gainers/losers, most active equities |
| **Options** | Option chain for equities or indices |
| **Charts** | Intraday or daily OHLC data from the charting API |
| **Technical** | 14 technical indicators (SMA, EMA, RSI, Bollinger, MACD, Stochastic, ATR, ADX, OBV, CCI, MFI, ROC, Momentum, Williams %R) with adjustable parameters |

## Features

- **Autocomplete** — 2000+ symbols, keyboard-navigable, client-side filtering
- **Caching** — per-endpoint TTL (30s intraday, 60s equity, 5m historical, 1h symbols)
- **Parallel loading** — sections load concurrently; one failure doesn't block others
- **Error isolation** — each section shows its own error banner + retry button
- **Pagination** — 100 rows per page with search filter
- **Export** — CSV (with BOM for Excel) and JSON buttons on every data section
- **Port auto-detection** — probes `localhost:3000`–`3003` (plus same-origin) at startup

## Files

```
dashboard/
├── index.html    HTML structure (tabs, controls, containers)
├── style.css     All styling (responsive, table, states)
├── app.js        All logic (API, cache, autocomplete, export, tabs)
└── README.md     This file
```
