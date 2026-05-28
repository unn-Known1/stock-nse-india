# NSE India Data Explorer — Dashboard

A browser-based dashboard for the [stock-nse-india](https://github.com/unn-Known1/stock-nse-india) API server. No build step, no framework — just open it.

## Quick Start

```bash
# One command — installs, builds, and starts everything
./launch.sh
```

Or manually:

```bash
# Terminal 1 — start the API server
npm start

# Terminal 2 — the dashboard is served by the API at http://localhost:3000
# (or open dashboard/index.html via any static file server)
```

The dashboard auto-detects the API server port by probing `3000`–`3003`.

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Market Overview** | Market status, turnover, all indices, trading/clearing holidays, glossary |
| **Stock Lookup** | Equity details, trade info, intraday data — pick a symbol via autocomplete |
| **Indices** | Index constituents, gainers/losers, most active equities |
| **Options** | Option chain for equities or indices |
| **Charts** | Intraday or daily OHLC data from the charting API |
| **Technical** | 14 indicators (SMA, EMA, RSI, Bollinger, MACD, Stochastic, ATR, ADX, OBV, CCI, MFI, ROC, Momentum, Williams %R) with adjustable parameters |
| **AI Assistant** | Natural-language queries about NSE data, powered by OpenAI via the MCP backend |

## AI Assistant Tab

Ask questions in plain English — the AI fetches live NSE data via MCP tools and answers in markdown.

**Requires `OPENAI_API_KEY` in `.env`.** Set it and restart the server. The tab shows a warning banner if the key is missing.

### Features

| Feature | Detail |
|---------|--------|
| **Query input** | Textarea with Enter-to-send (Shift+Enter for newline), live word/char counter |
| **Markdown responses** | Rendered via `marked.js` + `DOMPurify` (XSS-safe) — headings, tables, code blocks, blockquotes |
| **Loading indicator** | Elapsed-time spinner (e.g., "Thinking... 4.1s") |
| **Response timing** | Shows total time and token usage (prompt↑ / completion↓) after each response |
| **Cost banner** | Approximate per-query cost when reported by the backend |
| **Rate limit display** | Shows remaining requests and reset time when headers are present |
| **Regenerate** | Re-send the last query in the same session context |
| **Export** | Downloads the response as a `.txt` file |
| **Session bar** | Shows session ID, expiry countdown (MM:SS), and live context stats (messages, tokens) |
| **Session history** | Collapsible panel listing past sessions with Load and Delete actions |
| **Context polling** | Polls session stats every 10 s; pauses when the tab is hidden or another tab is active |
| **Session restore** | On page reload, validates the stored session ID against the server before showing it |
| **Ask AI buttons** | "Ask AI" shortcut in the Stock and Technical tabs — pre-fills a contextual question and switches to AI tab |

### Configuration Panel

Inside the AI Assistant tab, expand **Configuration** to adjust:

| Setting | Default | Notes |
|---------|---------|-------|
| Model | `gpt-4o-mini` | Also supports `gpt-4o`, `o3-mini` |
| Temperature | `0.7` | Slider capped at 1.0; higher = more creative / more costly |
| Max Tokens | `1024` | Maximum tokens in the response (64–8192) |
| System Prompt | Built-in | Editable; Ctrl+S saves while focused |
| Test Connection | — | Checks `/api/mcp/test` and reports whether the API key is configured |
| Debug Logging | Off | Enables verbose server-side logging; requires server restart |

Settings persist in `localStorage` across page reloads. Use **Reset to Defaults** to clear them.

### Tools Reference Panel

Expand **Available Tools** to browse all MCP tools the AI can call. The list is:

- Fetched once from `/api/mcp/tools` and cached for 1 hour
- Searchable by name or description
- Paginated (10 per page)
- Refreshable (clears cache and reloads)

---

## General Features

- **Autocomplete** — 2000+ symbols, keyboard-navigable, client-side filtering
- **Caching** — per-endpoint TTL (30 s intraday, 60 s equity, 5 m historical, 1 h symbols, 1 h MCP tools)
- **Parallel loading** — sections load concurrently; one failure doesn't block others
- **Error isolation** — each section shows its own error banner + retry button
- **Pagination** — 100 rows per page with search filter (10 per page for MCP tools)
- **Export** — CSV (with BOM for Excel) and JSON buttons on every data section; `.txt` for AI responses
- **Port auto-detection** — probes `localhost:3000`–`3003` (plus same-origin) at startup
- **Cache reset** — the "⟳ Refresh All" header button clears all caches including MCP tools

## Files

```
dashboard/
├── index.html    HTML structure — 7 tabs, controls, containers, CDN scripts
├── style.css     All styling — responsive, table, loading/error, MCP-specific
├── app.js        All logic — API, cache, autocomplete, export, tabs, AI assistant
└── README.md     This file
```

## Environment Variables

Set these in `.env` before starting the server:

| Variable | Required for AI tab | Description |
|----------|--------------------|----|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI Assistant queries |
| `MCP_DEBUG_LOGGING` | No | Set to `true` for verbose MCP logging (restart required) |

All other variables (`PORT`, `CORS_ORIGINS`, etc.) are documented in the root [README](../README.md).
