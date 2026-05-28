import type { NseIndia } from '../index.js'
import { getFeatureEntry } from '../feature-registry.js'

// Common MCP tools configuration for NSE India servers
export const mcpTools = [
  {
    name: 'get_all_stock_symbols',
    description: 'Get list of all NSE equity symbols',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_equity_details',
    description: 'Get equity details for a specific symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_trade_info',
    description: 'Get equity trade information for a specific symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_corporate_info',
    description: 'Get corporate information for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_intraday_data',
    description: 'Get intraday data for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_historical_data',
    description: 'Get historical data for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
        start_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_series',
    description: 'Get series data for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_stock_indices',
    description: 'Get equity stock indices for a specific index',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'string',
          description: 'Index name (e.g., NIFTY, BANKNIFTY)',
        },
      },
      required: ['index'],
    },
  },
  {
    name: 'get_index_intraday_data',
    description: 'Get intraday data for a specific index',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'string',
          description: 'Index name (e.g., NIFTY, BANKNIFTY)',
        },
      },
      required: ['index'],
    },
  },
  {
    name: 'get_index_option_chain',
    description: 'Get option chain data for a specific index',
    inputSchema: {
      type: 'object',
      properties: {
        index_symbol: {
          type: 'string',
          description: 'Index symbol (e.g., NIFTY, BANKNIFTY)',
        },
      },
      required: ['index_symbol'],
    },
  },
  {
    name: 'get_index_option_chain_contract_info',
    description: 'Get option chain contract information (expiry dates and strike prices) for a specific index',
    inputSchema: {
      type: 'object',
      properties: {
        index_symbol: {
          type: 'string',
          description: 'Index symbol (e.g., NIFTY, BANKNIFTY)',
        },
      },
      required: ['index_symbol'],
    },
  },
  {
    name: 'get_equity_option_chain',
    description: 'Get option chain data for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_commodity_option_chain',
    description: 'Get option chain data for a specific commodity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Commodity symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_glossary',
    description: 'Get NSE glossary content',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_trading_holidays',
    description: 'Get list of trading holidays',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_clearing_holidays',
    description: 'Get list of clearing holidays',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_market_status',
    description: 'Get current market status',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_market_turnover',
    description: 'Get market turnover data',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_all_indices',
    description: 'Get list of all indices',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_index_names',
    description: 'Get list of index names',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_circulars',
    description: 'Get list of circulars',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_latest_circulars',
    description: 'Get list of latest circulars',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_equity_master',
    description: 'Get equity master data with categorized indices',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pre_open_market_data',
    description: 'Get pre-open market data',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_merged_daily_reports_capital',
    description: 'Get merged daily reports for capital market',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_merged_daily_reports_derivatives',
    description: 'Get merged daily reports for derivatives',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_merged_daily_reports_debt',
    description: 'Get merged daily reports for debt market',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_equity_technical_indicators',
    description: 'Get technical indicators for a specific equity symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., TCS, RELIANCE)',
        },
        period: {
          type: 'number',
          description: 'Number of days for historical data (default: 200)',
        },
        sma_periods: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of periods for SMA indicators (e.g., [5, 10, 20, 50])',
        },
        ema_periods: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of periods for EMA indicators (e.g., [5, 10, 20, 50])',
        },
        rsi_period: {
          type: 'number',
          description: 'RSI period (default: 14)',
        },
        bb_period: {
          type: 'number',
          description: 'Bollinger Bands period (default: 20)',
        },
        bb_std_dev: {
          type: 'number',
          description: 'Bollinger Bands standard deviation (default: 2)',
        },
        show_only_latest: {
          type: 'boolean',
          description: 'Show only latest values (default: true)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_gainers_and_losers_by_index',
    description: 'Get top gainers and losers for a specific index',
    inputSchema: {
      type: 'object',
      properties: {
        index_symbol: {
          type: 'string',
          description: 'Index symbol (e.g., NIFTY 50, NIFTY BANK)',
        },
      },
      required: ['index_symbol'],
    },
  },
  {
    name: 'get_most_active_equities',
    description: 'Get most actively traded equities for a specific index, sorted by volume and value',
    inputSchema: {
      type: 'object',
      properties: {
        index_symbol: {
          type: 'string',
          description: 'Index symbol (e.g., NIFTY 50, NIFTY BANK)',
        },
      },
      required: ['index_symbol'],
    },
  },
  {
    name: 'get_equity_chart_historical_data',
    description: 'Get historical chart data from charting.nseindia.com for equity symbols with OHLC candle data',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Equity symbol with series code (e.g., ONGC, TCS)',
        },
        start: {
          type: 'string',
          description: 'Optional unix timestamp for start date (e.g., 1775834999)',
        },
        end: {
          type: 'string',
          description: 'Optional unix timestamp for end date (e.g., 1775999513)',
        },
        token: {
          type: 'string',
          description: 'NSE script code (token / scripCode) for the symbol. ' +
                       'If omitted, it is looked up automatically via get_equity_chart_symbol_info.',
        },
        symbol_type: {
          type: 'string',
          description: 'Type of symbol - Equity or Index (default: Equity)',
        },
        chart_type: {
          type: 'string',
          description: 'Chart type - I for intraday, D for daily (default: I)',
        },
        time_interval: {
          type: 'string',
          description: 'Time interval in minutes - 1, 5, 15, 30, 60. (default: 5)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_equity_chart_symbol_info',
    description:
      'Look up NSE charting symbol information for an equity symbol. Returns scripCode (token) ' +
      'needed by get_equity_chart_historical_data. Call this first when you do not already know the token.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Equity symbol with or without series code (e.g., ONGC or ONGC)',
        },
        segment: {
          type: 'string',
          description: 'Optional market segment filter. Leave empty to search all segments.',
        },
      },
      required: ['symbol'],
    },
  },
]

// Common tool call handler function
export async function handleMCPToolCall(
  nseClient: NseIndia,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let result: unknown

  const entry = getFeatureEntry(name)
  if (!entry) {
    throw new Error(`Unknown tool: ${name}`)
  }
  result = await entry.handler(nseClient, args)

  return result
}
