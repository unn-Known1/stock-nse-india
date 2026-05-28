# NSE India — API Endpoint Catalog

> **Purpose:** Reference for building a no-code dashboard with dropdown pre-filled options and CSV/JSON export.
> **Source:** REST routes + NseIndia class methods + MCP tools + GraphQL

---

## 1. MARKET REFERENCE (No Parameters)

These endpoints need zero input — just click and get data. Ideal for default dashboard widgets.

| # | Endpoint / Method | REST Route | What It Returns |
|---|-------------------|-----------|-----------------|
| 1 | Market Status | `GET /api/marketStatus` | Current market status (open/closed) per segment |
| 2 | Market Turnover | `GET /api/marketTurnover` | Securities traded, turnover data |
| 3 | All Indices | `GET /api/allIndices` | All NSE indices with current values |
| 4 | Index Names | `GET /api/indexNames` | List of all index names/symbols |
| 5 | All Symbols | `GET /api/allSymbols` | Sorted list of ALL NSE equity symbols (2000+) |
| 6 | Glossary | `GET /api/glossary` | NSE financial terms glossary |
| 7 | Equity Master | `GET /api/equityMaster` | Equity master with categorized indices |
| 8 | Pre-Open Market Data | `GET /api/preOpenMarket` | Pre-open indicative prices & quantities |
| 9 | Circulars | `GET /api/circulars` | NSE circulars list |
| 10 | Latest Circulars | `GET /api/circulars?isLatest=true` | Latest NSE circular |
| 11 | Trading Holidays | `GET /api/holidays?type=trading` | Trading holidays by segment |
| 12 | Clearing Holidays | `GET /api/holidays?type=clearing` | Clearing holidays by segment |
| 13 | Merged Reports (Capital) | `GET /api/mergedDailyReports?key=capital` | Daily reports for Capital Market |
| 14 | Merged Reports (Derivatives) | `GET /api/mergedDailyReports?key=derivatives` | Daily reports for Derivatives |
| 15 | Merged Reports (Debt) | `GET /api/mergedDailyReports?key=debt` | Daily reports for Debt Market |

**Dropdown UX:** Single "Go" button, no inputs needed. Auto-refresh every 60s.

---

## 2. EQUITY — DETAILS (Requires: Symbol)

Pre-filled dropdown: pick a stock symbol (from the 2000+ list), get data.

| # | Endpoint / Method | REST Route | Parameters | What It Returns |
|---|-------------------|-----------|-----------|-----------------|
| 16 | Equity Details | `GET /api/equity/:symbol` | `symbol` (text) | Company info, price, metadata, security info |
| 17 | Trade Info | `GET /api/equity/tradeInfo/:symbol` | `symbol` (text) | Day's high/low, volume, turnover, order book |
| 18 | Corporate Info | `GET /api/equity/corporateInfo/:symbol` | `symbol` (text) | Management, registered address, ISIN |
| 19 | Series | `GET /api/equity/series/:symbol` | `symbol` (text) | Available trading series (EQ, BE, SM) |
| 20 | Option Chain | `GET /api/equity/options/:symbol` | `symbol` (text) | Options chain — strikes, OI, volume, IV |
| 21 | Intraday | `GET /api/equity/intraday/:symbol` | `symbol` (text) | Today's tick data (5-min candles) |
| 22 | Historical | `GET /api/equity/historical/:symbol` | `symbol` (text), `dateStart` (optional YYYY-MM-DD), `dateEnd` (optional YYYY-MM-DD) | Daily OHLCV price history |
| 23 | Technical Indicators | `GET /api/equity/technicalIndicators/:symbol` | `symbol` (text), `period` (default 200), `smaPeriods`, `emaPeriods`, `rsiPeriod`, `bbPeriod`, `bbStdDev`, `showOnlyLatest` | SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, Williams %R, ATR, ADX, OBV, CCI, MFI, ROC, Momentum, A/D, VWAP |

### Technical Indicators — Available Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `period` | number | 200 | Days of historical data to use |
| `smaPeriods` | comma-separated | 5,10,20,50,100,200 | SMAs to compute |
| `emaPeriods` | comma-separated | 5,10,20,50,100,200 | EMAs to compute |
| `rsiPeriod` | number | 14 | RSI lookback period |
| `bbPeriod` | number | 20 | Bollinger Bands period |
| `bbStdDev` | number | 2 | Bollinger Bands std dev |
| `showOnlyLatest` | boolean | true | If true: latest values only. If false: full time series |

**Dropdown UX:** Symbol picker (autocomplete search) + optional date range pickers + "Get Data" button.

---

## 3. INDICES (Requires: Index Name)

Pre-filled dropdown: pick an index (NIFTY 50, BANKNIFTY, NIFTY AUTO, etc.).

| # | Endpoint / Method | REST Route | Parameters | What It Returns |
|---|-------------------|-----------|-----------|-----------------|
| 24 | Index Stocks | `GET /api/index/:indexSymbol` | `indexSymbol` (text) | All stocks in the index with price/change data |
| 25 | Index Intraday | `GET /api/index/intraday/:indexSymbol` | `indexSymbol` (text) | Index intraday graph data (timestamped prices) |
| 26 | Index Option Chain | `GET /api/index/options/:indexSymbol` | `indexSymbol` (text) | Full index option chain (strikes, OI, IV) |
| 27 | Option Chain Contract Info | `GET /api/index/options/contract-info/:indexSymbol` | `indexSymbol` (text) | Available expiry dates & strike prices |
| 28 | Gainers & Losers | `GET /api/gainersAndLosers/:indexSymbol` | `indexSymbol` (text) | Top gainers (sorted desc) + top losers (sorted asc) by % change |
| 29 | Most Active | `GET /api/mostActive/:indexSymbol` | `indexSymbol` (text) | Stocks sorted by volume + by value |

**Dropdown UX:** Index picker (e.g., NIFTY 50, BANKNIFTY, NIFTY AUTO, NIFTY IT, etc.) + "Get Data" button.

---

## 4. COMMODITY (Requires: Commodity Symbol)

| # | Endpoint / Method | REST Route | Parameters | What It Returns |
|---|-------------------|-----------|-----------|-----------------|
| 30 | Commodity Option Chain | `GET /api/commodity/options/:commoditySymbol` | `commoditySymbol` (text) | Commodity options chain |

**Dropdown UX:** Text input or pre-filled list of known commodity symbols.

---

## 5. CHARTING (Requires: Symbol + Optional Advanced Options)

| # | Endpoint / Method | REST Route | Parameters | What It Returns |
|---|-------------------|-----------|-----------|-----------------|
| 31 | Chart Historical Data | `GET /api/charts/equity-historical-data` | `symbol` (required), `start` (optional), `end` (optional), `token` (optional), `symbolType` (default "Equity"), `chartType` (default "I"), `timeInterval` (default "5") | OHLC candle data from charting.nseindia.com |
| 32 | Chart Symbol Info | `GET /api/charts/symbol-info` | `symbol` (required), `segment` (optional) | Script code / token (needed as `token` param above) |

### Charting Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `symbolType` | `Equity`, `Index` | `Equity` | Type of symbol |
| `chartType` | `I` (Intraday), `D` (Daily) | `I` | Chart resolution |
| `timeInterval` | `1`, `5`, `15`, `30`, `60` | `5` | Minutes per candle |
| `start` | YYYY-MM-DD or unix timestamp | auto | Range start |
| `end` | YYYY-MM-DD or unix timestamp | auto | Range end |

**Dropdown UX:** Symbol picker + chart type (Intraday/Daily) + interval (1/5/15/30/60 min) + optional date range.

---

## 6. MCP TOOLS (Natural Language / AI)

These are used by AI assistants, not direct REST. Include for completeness.

| # | Tool Name | Parameters | Description |
|---|-----------|-----------|-------------|
| 33 | `get_all_stock_symbols` | none | List all NSE equity symbols |
| 34 | `get_glossary` | none | NSE glossary |
| 35 | `get_trading_holidays` | none | Trading holidays |
| 36 | `get_clearing_holidays` | none | Clearing holidays |
| 37 | `get_market_status` | none | Current market status |
| 38 | `get_market_turnover` | none | Market turnover |
| 39 | `get_all_indices` | none | All indices |
| 40 | `get_index_names` | none | Index names |
| 41 | `get_circulars` | none | Circulars |
| 42 | `get_latest_circulars` | none | Latest circulars |
| 43 | `get_equity_master` | none | Equity master |
| 44 | `get_pre_open_market_data` | none | Pre-open data |
| 45 | `get_merged_daily_reports_capital` | none | Capital market daily report |
| 46 | `get_merged_daily_reports_derivatives` | none | Derivatives daily report |
| 47 | `get_merged_daily_reports_debt` | none | Debt market daily report |
| 48 | `get_equity_details` | `symbol` | Equity details |
| 49 | `get_equity_trade_info` | `symbol` | Trade info |
| 50 | `get_equity_corporate_info` | `symbol` | Corporate info |
| 51 | `get_equity_intraday_data` | `symbol` | Intraday data |
| 52 | `get_equity_series` | `symbol` | Series data |
| 53 | `get_equity_option_chain` | `symbol` | Equity option chain |
| 54 | `get_commodity_option_chain` | `commoditySymbol` | Commodity option chain |
| 55 | `get_equity_historical_data` | `symbol`, `start_date`, `end_date` | Historical data |
| 56 | `get_equity_technical_indicators` | `symbol`, `period`, various indicator options | Technical indicators |
| 57 | `get_equity_stock_indices` | `index` | Index constituent stocks |
| 58 | `get_index_intraday_data` | `index` | Index intraday |
| 59 | `get_index_option_chain` | `index_symbol` | Index option chain |
| 60 | `get_index_option_chain_contract_info` | `index_symbol` | Contract info |
| 61 | `get_gainers_and_losers_by_index` | `index_symbol` | Gainers & losers |
| 62 | `get_most_active_equities` | `index_symbol` | Most active equities |
| 63 | `get_equity_chart_historical_data` | `symbol`, `start`, `end`, `token`, `symbol_type`, `chart_type`, `time_interval` | Chart OHLC data |
| 64 | `get_equity_chart_symbol_info` | `symbol`, `segment` | Chart symbol info / token |

---

## 7. GRAPHQL (Modern API)

Single endpoint: `POST /graphql` with query in body.

| Query | Arguments | Returns | Description |
|-------|-----------|---------|-------------|
| `equities` | `symbolFilter`: `{ startsWith, in: [...], nin: [...], eq, neq, offset, limit }` | `[Equity]` with nested `details { info, metadata }` | Query equity data with powerful filtering |
| `indices` | `filter`: `{ filterBy, criteria }` | `[Index]` with price/change data | Query index data |

### GraphQL Equity Type

```graphql
type Equity {
  symbol: String!
  details: {
    info: { companyName, industry, isFNOSec, isin, activeSeries, ... }
    metadata: { listingDate, series, status, lastUpdateTime, ... }
  }
}
```

### GraphQL Index Type

```graphql
type Index {
  key, index, indexSymbol, last, variation, percentChange,
  open, high, low, previousClose, yearHigh, yearLow
}
```

**Dropdown UX:** Simple form with symbol filter fields (startsWith, in, etc.) + "Query" button. Results in table format.

---

## 8. SERVER INFO

| # | Endpoint | What It Returns |
|---|----------|-----------------|
| 65 | `GET /` | Market status (homepage) |
| 66 | `GET /api/v1/swagger.json` | OpenAPI spec for Swagger UI |

---

## DASHBOARD WIDGET SUGGESTIONS

```yaml
widgets:
  - name: Market Overview
    endpoints: [1, 2, 3, 4, 11, 12, 13, 14, 15]
    refresh: 60s
    layout: cards grid

  - name: Stock Lookup
    endpoints: [16, 17, 22, 23]
    inputs: [symbol dropdown]
    layout: tabs (Details / Trade / History / Indicators)

  - name: Index Explorer
    endpoints: [24, 25, 28, 29]
    inputs: [index dropdown]
    layout: table + chart

  - name: Options Chain
    endpoints: [20, 26, 27, 30]
    inputs: [symbol/index dropdown]
    layout: options chain table

  - name: Chart Viewer
    endpoint: [31, 32]
    inputs: [symbol dropdown, chart type, interval, date range]
    layout: candlestick chart

  - name: Technical Analysis
    endpoint: [23]
    inputs: [symbol dropdown, indicator options]
    layout: indicator values table + charts
```
