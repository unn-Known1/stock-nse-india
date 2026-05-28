
[![NPM](https://nodei.co/npm/stock-nse-india.png)](https://nodei.co/npm/stock-nse-india/)

# National Stock Exchange - India (Unofficial)

![](https://github.com/unn-Known1/stock-nse-india/workflows/CI/badge.svg) ![npm](https://img.shields.io/npm/dt/stock-nse-india) ![NPM](https://img.shields.io/npm/l/stock-nse-india) ![GitHub Release Date - Published_At](https://img.shields.io/npm/v/stock-nse-india) ![GitHub top language](https://img.shields.io/github/languages/top/unn-Known1/stock-nse-india)

A comprehensive package and API server for accessing equity/index details and historical data from the National Stock Exchange of India. Provides an NPM package, a full-featured REST/GraphQL API server, a CLI tool, and a browser dashboard.

**📚 [Documentation](https://hi-imcodeman.github.io/stock-nse-india)** | **🚀 [Examples](https://github.com/unn-Known1/stock-nse-india/tree/master/examples)**

## ✨ Features

- **📦 NPM Package** — Direct integration into Node.js projects
- **🔌 REST + GraphQL API** — Swagger-documented endpoints + Apollo Server
- **🤖 MCP Server** — [Model Context Protocol](MCP_README.md) for AI assistants
- **💻 CLI** — Command-line data access
- **🐳 Docker** — Containerized deployment
- **📊 Dashboard** — Browser-based UI (auto-detects API port)
- **📈 Data**: Equity, Index, Commodity, Options, Technical indicators

## 🚀 Quick Start

**Prerequisites:** Node.js 18+

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

- **Main App:** http://localhost:3000
- **GraphQL:** http://localhost:3000/graphql
- **API Docs:** http://localhost:3000/api-docs

## 📊 Dashboard

A no-build browser dashboard with 6 tabs (Market, Stock, Indices, Options, Charts, Technical), autocomplete for 2000+ symbols, pagination, CSV/JSON export, and auto-detection of the API server port.

```bash
npm start                    # Terminal 1: start API server
npx serve dashboard          # Terminal 2: open dashboard
```

See [dashboard/README.md](dashboard/README.md) for full details.

## ⚙️ Configuration

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST_URL` | `http://localhost:3000` | Public host URL |
| `NODE_ENV` | `development` | Environment |
| `CORS_ORIGINS` | `*` | Allowed origins (comma-separated) |
| `HTTPS_ENABLED` | `false` | Enable HTTPS (needs mkcert certs) |

## 🏃‍♂️ Development

```bash
git clone https://github.com/unn-Known1/stock-nse-india.git
cd stock-nse-india
npm install
npm run start:dev    # dev mode with auto-reload
npm run build        # build TypeScript
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Production server |
| `npm run start:dev` | Dev mode with auto-reload |
| `npm run build` | Build TypeScript |
| `npm test` | Unit/mock tests with coverage |
| `npm run test:e2e` | Live NSE e2e tests |
| `npm run start:mcp` | Start stdio MCP server |
| `npm run lint` | ESLint |
| `npm run docs` | TypeDoc documentation |

## 🧪 Testing

```bash
npm test                    # unit/mock tests
npm test -- --coverage      # with coverage
npm run test:e2e            # live NSE e2e tests
```

## 🤝 Contributing

Fork, create a feature branch, make changes with tests, ensure all tests pass, submit a PR.

## 📄 License

MIT — see [LICENSE](LICENSE).

## 👥 Contributors

<a href="https://github.com/unn-Known1/stock-nse-india/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=unn-Known1/stock-nse-india" />
</a>

## 🔗 Links

- **🌐 [Website](https://hi-imcodeman.github.io/stock-nse-india)**
- **📦 [NPM](https://www.npmjs.com/package/stock-nse-india)**
- **🐳 [Docker Hub](https://hub.docker.com/r/imcodeman/nseindia)**
- **🐛 [Issues](https://github.com/unn-Known1/stock-nse-india/issues)**

---

**⭐ Star this repository if you find it helpful!**
