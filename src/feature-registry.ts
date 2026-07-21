import type { NseIndia } from './index.js'
import { getGainersAndLosersByIndex, getMostActiveEquities } from './helpers.js'
import { formatLatestIndicators, formatAllIndicators } from './indicators-formatter.js'

export interface FeatureEntry {
  name: string
  description: string
  requiredParams: string[]
  handler: (client: NseIndia, args: Record<string, unknown>) => Promise<unknown>
}

function getSymbol(args: Record<string, unknown>): string {
  if (typeof args?.symbol !== 'string') throw new Error('Symbol parameter is required and must be a string')
  return args.symbol
}

function getIndex(args: Record<string, unknown>): string {
  if (typeof args?.index !== 'string') throw new Error('Index parameter is required and must be a string')
  return args.index
}

function getIndexSymbol(args: Record<string, unknown>): string {
  if (typeof args?.index_symbol !== 'string') throw new Error('Index symbol parameter is required and must be a string')
  return args.index_symbol
}

const registry: Record<string, FeatureEntry> = {
  get_all_stock_symbols: {
    name: 'get_all_stock_symbols',
    description: 'Get list of all NSE equity symbols',
    requiredParams: [],
    handler: async (client) => client.getAllStockSymbols()
  },
  get_equity_details: {
    name: 'get_equity_details',
    description: 'Get equity details for a specific symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquityDetails(getSymbol(args))
  },
  get_equity_trade_info: {
    name: 'get_equity_trade_info',
    description: 'Get equity trade information for a specific symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquityTradeInfo(getSymbol(args))
  },
  get_equity_corporate_info: {
    name: 'get_equity_corporate_info',
    description: 'Get corporate information for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquityCorporateInfo(getSymbol(args))
  },
  get_equity_intraday_data: {
    name: 'get_equity_intraday_data',
    description: 'Get intraday data for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquityIntradayData(getSymbol(args))
  },
  get_equity_historical_data: {
    name: 'get_equity_historical_data',
    description: 'Get historical data for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => {
      const symbol = getSymbol(args)
      const range = args.start_date && args.end_date &&
        typeof args.start_date === 'string' &&
        typeof args.end_date === 'string'
        ? { start: new Date(args.start_date), end: new Date(args.end_date) }
        : undefined
      return client.getEquityHistoricalData(symbol, range)
    }
  },
  get_equity_series: {
    name: 'get_equity_series',
    description: 'Get series data for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquitySeries(getSymbol(args))
  },
  get_equity_stock_indices: {
    name: 'get_equity_stock_indices',
    description: 'Get equity stock indices for a specific index',
    requiredParams: ['index'],
    handler: async (client, args) => client.getEquityStockIndices(getIndex(args))
  },
  get_index_intraday_data: {
    name: 'get_index_intraday_data',
    description: 'Get intraday data for a specific index',
    requiredParams: ['index'],
    handler: async (client, args) => client.getIndexIntradayData(getIndex(args))
  },
  get_index_option_chain: {
    name: 'get_index_option_chain',
    description: 'Get option chain data for a specific index',
    requiredParams: ['index_symbol'],
    handler: async (client, args) => client.getIndexOptionChain(getIndexSymbol(args))
  },
  get_index_option_chain_contract_info: {
    name: 'get_index_option_chain_contract_info',
    description: 'Get option chain contract information for a specific index',
    requiredParams: ['index_symbol'],
    handler: async (client, args) => client.getIndexOptionChainContractInfo(getIndexSymbol(args))
  },
  get_equity_option_chain: {
    name: 'get_equity_option_chain',
    description: 'Get option chain data for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => client.getEquityOptionChain(getSymbol(args))
  },
  get_commodity_option_chain: {
    name: 'get_commodity_option_chain',
    description: 'Get option chain data for a specific commodity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => {
      if (typeof args?.symbol !== 'string') throw new Error('Symbol parameter is required and must be a string')
      return client.getCommodityOptionChain(args.symbol)
    }
  },
  get_glossary: {
    name: 'get_glossary',
    description: 'Get NSE glossary content',
    requiredParams: [],
    handler: async (client) => client.getGlossary()
  },
  get_trading_holidays: {
    name: 'get_trading_holidays',
    description: 'Get list of trading holidays',
    requiredParams: [],
    handler: async (client) => client.getTradingHolidays()
  },
  get_clearing_holidays: {
    name: 'get_clearing_holidays',
    description: 'Get list of clearing holidays',
    requiredParams: [],
    handler: async (client) => client.getClearingHolidays()
  },
  get_market_status: {
    name: 'get_market_status',
    description: 'Get current market status',
    requiredParams: [],
    handler: async (client) => client.getMarketStatus()
  },
  get_market_turnover: {
    name: 'get_market_turnover',
    description: 'Get market turnover data',
    requiredParams: [],
    handler: async (client) => client.getMarketTurnover()
  },
  get_all_indices: {
    name: 'get_all_indices',
    description: 'Get list of all indices',
    requiredParams: [],
    handler: async (client) => client.getAllIndices()
  },
  get_index_names: {
    name: 'get_index_names',
    description: 'Get list of index names',
    requiredParams: [],
    handler: async (client) => client.getIndexNames()
  },
  get_circulars: {
    name: 'get_circulars',
    description: 'Get list of circulars',
    requiredParams: [],
    handler: async (client) => client.getCirculars()
  },
  get_latest_circulars: {
    name: 'get_latest_circulars',
    description: 'Get list of latest circulars',
    requiredParams: [],
    handler: async (client) => client.getLatestCirculars()
  },
  get_equity_master: {
    name: 'get_equity_master',
    description: 'Get equity master data with categorized indices',
    requiredParams: [],
    handler: async (client) => client.getEquityMaster()
  },
  get_pre_open_market_data: {
    name: 'get_pre_open_market_data',
    description: 'Get pre-open market data',
    requiredParams: [],
    handler: async (client) => client.getPreOpenMarketData()
  },
  get_merged_daily_reports_capital: {
    name: 'get_merged_daily_reports_capital',
    description: 'Get merged daily reports for capital market',
    requiredParams: [],
    handler: async (client) => client.getMergedDailyReportsCapital()
  },
  get_merged_daily_reports_derivatives: {
    name: 'get_merged_daily_reports_derivatives',
    description: 'Get merged daily reports for derivatives',
    requiredParams: [],
    handler: async (client) => client.getMergedDailyReportsDerivatives()
  },
  get_merged_daily_reports_debt: {
    name: 'get_merged_daily_reports_debt',
    description: 'Get merged daily reports for debt market',
    requiredParams: [],
    handler: async (client) => client.getMergedDailyReportsDebt()
  },
  get_equity_technical_indicators: {
    name: 'get_equity_technical_indicators',
    description: 'Get technical indicators for a specific equity symbol',
    requiredParams: ['symbol'],
    handler: async (client, args) => {
      const symbol = getSymbol(args)
      const options: Record<string, unknown> = {}
      const showOnlyLatest = args.show_only_latest !== undefined ? args.show_only_latest : true

      if (args.period && typeof args.period === 'number') options.period = args.period
      if (args.sma_periods && Array.isArray(args.sma_periods)) options.smaPeriods = args.sma_periods
      if (args.ema_periods && Array.isArray(args.ema_periods)) options.emaPeriods = args.ema_periods
      if (args.rsi_period && typeof args.rsi_period === 'number') options.rsiPeriod = args.rsi_period
      if (args.bb_period && typeof args.bb_period === 'number') options.bbPeriod = args.bb_period
      if (args.bb_std_dev && typeof args.bb_std_dev === 'number') options.bbStdDev = args.bb_std_dev

      const indicators = await client.getTechnicalIndicators(symbol, (options.period as number) || 200, options)

      if (showOnlyLatest) {
        return formatLatestIndicators(indicators)
      }
      return formatAllIndicators(indicators)
    }
  },
  get_gainers_and_losers_by_index: {
    name: 'get_gainers_and_losers_by_index',
    description: 'Get top gainers and losers for a specific index',
    requiredParams: ['index_symbol'],
    handler: async (_client, args) => getGainersAndLosersByIndex(getIndexSymbol(args))
  },
  get_most_active_equities: {
    name: 'get_most_active_equities',
    description: 'Get most actively traded equities for a specific index',
    requiredParams: ['index_symbol'],
    handler: async (_client, args) => getMostActiveEquities(getIndexSymbol(args))
  },
  get_equity_chart_historical_data: {
    name: 'get_equity_chart_historical_data',
    description: 'Get historical chart data from charting.nseindia.com',
    requiredParams: ['symbol'],
    handler: async (client, args) => {
      const symbol = getSymbol(args)
      const startInput = args?.start ?? args?.from_date
      const endInput = args?.end ?? args?.to_date
      const hasStartDate = startInput !== undefined && startInput !== null
      const hasEndDate = endInput !== undefined && endInput !== null

      if (hasStartDate && typeof startInput !== 'string') throw new Error('start parameter must be a string (unix timestamp)')
      if (hasEndDate && typeof endInput !== 'string') throw new Error('end parameter must be a string (unix timestamp)')

      const token = args.token && typeof args.token === 'string' ? args.token : undefined
      const symbolType = args.symbol_type && typeof args.symbol_type === 'string' ? args.symbol_type : 'Equity'
      const chartType = args.chart_type && typeof args.chart_type === 'string' ? args.chart_type : 'I'
      const timeInterval = args.time_interval && typeof args.time_interval === 'string' ? args.time_interval : '5'

      let range
      if (hasStartDate || hasEndDate) {
        const end = hasEndDate ? new Date(Number(endInput) * 1000) : new Date()
        const start = hasStartDate ? new Date(Number(startInput) * 1000) : new Date(end.getTime() - 24 * 60 * 60 * 1000)
        if (!(start.getTime() > 0 && end.getTime() > 0)) {
          throw new Error('Invalid date format. start/end must be unix timestamps')
        }
        range = { start, end }
      }

      return client.getEquityChartHistoricalData(symbol, range, token, symbolType, chartType, timeInterval)
    }
  },
  get_equity_chart_symbol_info: {
    name: 'get_equity_chart_symbol_info',
    description: 'Look up NSE charting symbol information',
    requiredParams: ['symbol'],
    handler: async (client, args) => {
      const symbol = getSymbol(args)
      const segment = args.segment && typeof args.segment === 'string' ? args.segment : ''
      return client.getEquitySymbolInfo(symbol, segment)
    }
  }
}

export function getFeatureNames(): string[] {
  return Object.keys(registry)
}

export function getFeatureEntry(name: string): FeatureEntry | undefined {
  return registry[name]
}

export function getFeatureRegistry(): Record<string, FeatureEntry> {
  return registry
}
