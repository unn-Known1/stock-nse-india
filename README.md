
<p align="center">
  <img src="https://nodei.co/npm/stock-nse-india.png" alt="npm">
</p>

# National Stock Exchange - India (Unofficial)

> **Fork** of [hi-imcodeman/stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) —
> all credit to the original author for the excellent NSE API package.

![npm](https://img.shields.io/npm/dt/stock-nse-india)
![NPM](https://img.shields.io/npm/l/stock-nse-india)
![npm](https://img.shields.io/npm/v/stock-nse-india)
![GitHub top language](https://img.shields.io/github/languages/top/unn-Known1/stock-nse-india)

A comprehensive package and API server for accessing equity, index, commodity, and options data from the National Stock Exchange of India. Ships as an NPM package, a REST/GraphQL API server, a CLI tool, an MCP server for AI assistants, and a browser-based dashboard.

---

## ✨ What's in this Fork

| Improvement | Detail |
|------------|--------|
| 🖥️ **Browser Dashboard** | 7-tab UI (Market, Stock, Indices, Options, Charts, Technical, **AI Assistant**) — auto-detects API port, no build step |
| 🤖 **AI Assistant Tab** | Ask natural-language questions about NSE data; markdown responses, session management, token usage display |
| 🐞 **44 Gap-Analysis Fixes** | 16 critical, 13 high, 15 medium issues resolved across 22 files |
| ✅ **All 193 Tests Passing** | Full test suite green across all 9 spec files |
| 📈 **Technical Indicators** | 14 indicators (SMA, EMA, RSI, Bollinger, MACD, Stochastic, ATR, ADX, OBV, CCI, MFI, ROC, Momentum, Williams %R) |
| 🚦 **Port Auto-Detection** | Dashboard probes `3000`–`3003` at startup — run the API on any port |
| 🔄 **Per-Symbol Caching** | Charting symbol lookup now cached per-symbol instead of using wildcards |
| 🧪 **Robust Test Mocks** | Session, charting, and equity tests no longer make real HTTP calls |

---

## 🚀 Quick Start

**Prerequisites:** Node.js 18+

### As an NPM Package

```bash
npm install stock-nse-india
```

```javascript
import { NseIndia } from "stock-nse-india";

const nseIndia = new NseIndia();
const symbols = await nseIndia.getAllStockSymbols();
const details = await nseIndia.getEquityDetails('IRCTC');
```

### As an API Server

```bash
git clone https://github.com/unn-Known1/stock-nse-india.git
cd stock-nse-india
npm install
cp .env.example .env
npm start
```

### Launch Dashboard (One Command)

```bash
git clone https://github.com/unn-Known1/stock-nse-india.git
cd stock-nse-india
./launch.sh
```

The script handles everything — copies `.env`, installs deps, builds TypeScript, and starts the server. The dashboard is served at `http://localhost:3000` (no separate `serve` command needed).

---

## 📊 Browser Dashboard

A no-build, zero-dependency dashboard that talks to the NSE API server.

```
dashboard/
├── index.html       ← 7-tab layout with export buttons
├── style.css        ← Responsive, table, loading/error states
├── app.js           ← All logic (API, cache, autocomplete, tables, export, AI)
└── README.md        ← Full dashboard docs
```

| Tab | What you get |
|-----|-------------|
| **Market Overview** | Market status, turnover, all indices, trading/clearing holidays, glossary — loaded in parallel |
| **Stock Lookup** | Equity details, trade info, intraday data — pick from 2000+ symbols via keyboard-navigable autocomplete |
| **Indices** | Constituent stocks, gainers/losers, most active equities by index |
| **Options** | Option chain — equity or index, with contract info |
| **Charts** | Intraday or daily OHLC from the charting API |
| **Technical** | 14 indicators with adjustable parameters + checkbox toggles |
| **AI Assistant** | Natural-language queries powered by OpenAI; markdown responses, session history, context stats, configurable model/temperature |

Every data section has:
- **CSV/JSON export** buttons (CSV includes BOM for Excel)
- **Pagination** (100 rows/page) + search filter
- **Error isolation** — one section failing doesn't block others; each gets a retry button
- **TTL-based caching** — 30s intraday, 60s equity, 5m historical, 1h symbols

---

## ✨ Features (Original + Fork)

### 📦 NPM Package

| Method | Description |
|--------|-------------|
| `getAllStockSymbols()` | All NSE stock symbols |
| `getEquityDetails(symbol)` | Equity information |
| `getEquityHistoricalData(symbol, range)` | Historical price data |
| `getEquityIntradayData(symbol)` | Intraday trading data |
| `getEquityOptionChain(symbol)` | Options chain |
| `getEquityCorporateInfo(symbol)` | Corporate information |
| `getEquityTradeInfo(symbol)` | Trading statistics |
| `getEquityChartHistoricalData(symbol, range?, token?, type?, interval?)` | Charting OHLC |
| `getEquitySymbolInfo(symbol, segment?)` | Charting symbol/token resolution |
| `getAllStockSymbols()` | All symbols for autocomplete |
| `getEquityStockIndices()` | All market indices |
| `getIndexIntradayData(index)` | Index intraday |
| `getIndexOptionChain(index)` | Index options |
| `getIndexOptionChainContractInfo(symbol)` | Expiry dates & strikes |
| `getCommodityOptionChain(symbol)` | Commodity options |
| `getGainersAndLosersByIndex(index)` | Top gainers & losers |
| `getMostActiveEquities()` | Most active stocks |
| `getData()` / `getDataByEndpoint()` | Generic NSE data retrieval |

### 🌐 REST API

All endpoints are auto-documented via Swagger at `http://localhost:3000/api-docs`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/marketStatus` | Market status |
| `GET /api/glossary` | NSE glossary |
| `GET /api/equity/:symbol` | Equity details (with fallback chain) |
| `GET /api/equity/tradeInfo/:symbol` | Trade info / order book |
| `GET /api/equity/intraday/:symbol` | Intraday OHLC |
| `GET /api/equity/:symbol/historical` | Historical data |
| `GET /api/indices` | All market indices |
| `GET /api/charts/equity-historical-data` | Charting OHLC historical |
| `GET /api/charts/symbol-info` | Charting symbol/token |
| `GET /api/mcp/query` | Natural-language MCP query |

### 🔌 GraphQL API

Available at `http://localhost:3000/graphql` with Apollo Studio.

```graphql
query GetEquity {
  equities(symbolFilter: { in: ["IRCTC", "TCS"] }) {
    symbol
    details { info { companyName industry } }
  }
}
```

### 🤖 MCP Server (AI Assistants)

Model Context Protocol server for AI tools like Cursor, Claude, etc. See [MCP_README.md](MCP_README.md) for configuration.

```bash
npm run start:mcp     # Start stdio MCP server
npm run test:mcp      # Test it
```

### 💻 CLI

```bash
nseindia              # Market status
nseindia equity IRCTC # Equity details
nseindia historical IRCTC
nseindia index        # All indices
nseindia index "NIFTY AUTO"
```

### 🐳 Docker

```bash
docker run --rm -d -p 3001:3001 imcodeman/nseindia
```

---

## ⚙️ Configuration

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST_URL` | `http://localhost:3000` | Public URL |
| `NODE_ENV` | `development` | Environment |
| `CORS_ORIGINS` | `*` | Allowed origins (comma-separated) |
| `OPENAI_API_KEY` | — | **Required for AI Assistant tab** — OpenAI key (`sk-…`) or provider key (e.g. `nvapi-…` for NVIDIA NIM) |
| `OPENAI_BASE_URL` | — | OpenAI-compatible base URL — leave blank for OpenAI; set for other providers (e.g. `https://integrate.api.nvidia.com/v1`) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model ID to use — must match what the provider expects (e.g. `moonshotai/kimi-k2-instruct`) |
| `MCP_DEBUG_LOGGING` | `false` | Verbose MCP request/response logging (restart to apply) |
| `HTTPS_ENABLED` | `false` | Enable HTTPS (needs mkcert certs) |
| `SSL_KEY_PATH` | `./certs/localhost-key.pem` | TLS key |
| `SSL_CERT_PATH` | `./certs/localhost.pem` | TLS cert |

### Local HTTPS (Safari + Apollo Studio)

```bash
brew install mkcert && mkcert -install
mkdir -p certs && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1
# Set HTTPS_ENABLED=true, HOST_URL=https://localhost:3000 in .env
npm start
```

---

## 🏃‍♂️ Development

```bash
git clone https://github.com/unn-Known1/stock-nse-india.git
cd stock-nse-india
npm install
npm run start:dev   # Dev mode with auto-reload
npm run build       # TypeScript build
```

### Scripts

| Script | Description |
|--------|-------------|
| `./launch.sh` | One-command dashboard launcher (install + build + start) |
| `npm start` | Production server |
| `npm run start:dev` | Dev mode (auto-reload) |
| `npm run build` | Build TypeScript → JS |
| `npm test` | Unit/mock tests with coverage |
| `npm run test:e2e` | Live NSE e2e tests |
| `npm run start:mcp` | Start stdio MCP server |
| `npm run test:mcp` | Test MCP server |
| `npm run lint` | ESLint |
| `npm run docs` | TypeDoc |

---

## 🧪 Testing

```bash
npm test                    # Unit/mock tests (193 tests, 9 suites)
npm test -- --coverage      # With coverage report
npm run test:e2e            # Live NSE e2e (requires network)
npm test -- foo.spec.ts     # Single test file
```

---

## 📚 Additional Docs

- [Dashboard README](dashboard/README.md) — Full dashboard usage
- [MCP Server Docs](MCP_README.md) — MCP server configuration, tools reference, context summarization

---

## 👥 Credits

This is a fork of [hi-imcodeman/stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india). All original work — the NSE API integration, NPM package, GraphQL/REST/MCP/CLI servers, and Docker support — was built by the original author. This fork adds the browser dashboard (including the AI Assistant tab), fixes 44 gap-analysis findings, and provides API endpoint documentation.

Original contributors:

<a href="https://github.com/hi-imcodeman/stock-nse-india/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=hi-imcodeman/stock-nse-india" />
</a>

---

## 📄 License

MIT — see [LICENSE](LICENSE).

## 🔗 Links

- **📦 [NPM](https://www.npmjs.com/package/stock-nse-india)**
- **🐳 [Docker Hub](https://hub.docker.com/r/imcodeman/nseindia)**
- **📖 [Original Repo](https://github.com/hi-imcodeman/stock-nse-india)**
- **🐛 [Issues](https://github.com/unn-Known1/stock-nse-india/issues)**
