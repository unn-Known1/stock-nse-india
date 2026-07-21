import { Router } from 'express'
import { openapiSpecification } from './swaggerDocOptions.js'
import { NseIndia, ApiList } from './index.js'
import {
    getGainersAndLosersByIndex,
    getMostActiveEquities
} from './helpers.js'
import { getMcpClient, MCPClientRequest, MCPClient } from './mcp/client/mcp-client.js'
import { sendRouteError } from './route-errors.js'
import { TechnicalIndicatorOptions } from './interface.js'
import { formatLatestIndicators, formatAllIndicators } from './indicators-formatter.js'

function validateApiKey(key: string): boolean {
    if (process.env.OPENAI_BASE_URL) return key.length >= 8
    return /^sk-[A-Za-z0-9]{20,}$/.test(key)
}

function isValidSymbol(symbol: string): boolean {
    return /^[A-Z0-9]{1,20}$/.test(symbol)
}

const mainRouter: Router = Router()

const nseIndia = new NseIndia()


/**
 * @openapi
 * /:
 *   get:
 *     description: To get market status
 *     tags:
 *       - Base
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE market status
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/', async (_req, res) => {
    try {
        res.json(await nseIndia.getDataByEndpoint(ApiList.MARKET_STATUS))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/v1/swagger.json:
 *   get:
 *     description: To get open api specification for swagger documentation
 *     tags:
 *       - Base
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of open api specification
 */
mainRouter.get('/api/v1/swagger.json', (_req, res) => {
    res.json(openapiSpecification)
})

/**
 * @openapi
 * /api/glossary:
 *   get:
 *     description: To get glossary of NSE India
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of glossary for NSE India
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/glossary', async (_req, res) => {
    try {
        res.json(await nseIndia.getDataByEndpoint(ApiList.GLOSSARY))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/marketStatus:
 *   get:
 *     description: To get market status
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE market status
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/marketStatus', async (_req, res) => {
    try {
        res.json(await nseIndia.getDataByEndpoint(ApiList.MARKET_STATUS))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/marketTurnover:
 *   get:
 *     description: To get market turn over
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE market turn over
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/marketTurnover', async (_req, res) => {
    try {
        res.json(await nseIndia.getDataByEndpoint(ApiList.MARKET_TURNOVER))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equityMaster:
 *   get:
 *     description: To get equity master
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE equity master
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equityMaster', async (_req, res) => {
    try {
        res.json(await nseIndia.getDataByEndpoint(ApiList.EQUITY_MASTER))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/holidays:
 *   get:
 *     description: To get holidays of NSE India
 *     tags:
 *       - Common
 *     parameters:
 *       - name: type
 *         in: query
 *         description: Holiday list for
 *         required: true
 *         schema:
 *           type: string
 *           enum: [trading,clearing]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE India's holidays
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/holidays', async (req, res) => {
    try {
        const { type } = req.query
        if (type === 'clearing') {
            res.json(await nseIndia.getDataByEndpoint(ApiList.HOLIDAY_CLEARING))
        } else {
            res.json(await nseIndia.getDataByEndpoint(ApiList.HOLIDAY_TRADING))
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/circulars:
 *   get:
 *     description: To get NSE India's circulars
 *     tags:
 *       - Common
 *     parameters:
 *       - name: isLatest
 *         in: query
 *         description: Boolean value get latest circulars
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE India's circulars
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/circulars', async (req, res) => {
    try {
        const { isLatest } = req.query
        if (isLatest === 'true') {
            res.json(await nseIndia.getDataByEndpoint(ApiList.LATEST_CIRCULARS))
        } else {
            res.json(await nseIndia.getDataByEndpoint(ApiList.CIRCULARS))
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mergedDailyReports:
 *   get:
 *     description: To get merged daily reports
 *     tags:
 *       - Common
 *     parameters:
 *       - name: key
 *         in: query
 *         description: Key for merged daily reports
 *         required: true
 *         schema:
 *           type: string
 *           enum: [capital,derivatives,debt]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of NSE India's merged daily reports
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/mergedDailyReports', async (req, res) => {
    try {
        const { key } = req.query
        if (key === 'debt') {
            res.json(await nseIndia.getDataByEndpoint(ApiList.MERGED_DAILY_REPORTS_DEBT))
        } else if (key === 'derivatives') {
            res.json(await nseIndia.getDataByEndpoint(ApiList.MERGED_DAILY_REPORTS_DERIVATIVES))
        } else {
            res.json(await nseIndia.getDataByEndpoint(ApiList.MERGED_DAILY_REPORTS_CAPITAL))
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/allIndices:
 *   get:
 *     description: To get all NSE indices
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of all NSE indices
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/allIndices', async (_req, res) => {
    try {
        const allIndices = await nseIndia.getDataByEndpoint(ApiList.ALL_INDICES)
        res.json(allIndices)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/indexNames:
 *   get:
 *     description: To get all NSE index names
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of all NSE index names
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/indexNames', async (_req, res) => {
    try {
        const indexNames = await nseIndia.getDataByEndpoint(ApiList.INDEX_NAMES)
        res.json(indexNames)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/allSymbols:
 *   get:
 *     description: To get all NSE equity symbols
 *     tags:
 *       - Common
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns an array of NSE equity symbols
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/allSymbols', async (_req, res) => {
    try {
        const symbols = await nseIndia.getAllStockSymbols()
        res.json(symbols)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/series/{symbol}:
 *   get:
 *     description: To get equity series of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a equity series of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/series/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        res.json(await nseIndia.getEquitySeries(symbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/tradeInfo/{symbol}:
 *   get:
 *     description: To get trade info of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a trade info of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/tradeInfo/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        res.json(await nseIndia.getEquityTradeInfo(symbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/corporateInfo/{symbol}:
 *   get:
 *     description: To get corporate info of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a corporate info of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/corporateInfo/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        res.json(await nseIndia.getEquityCorporateInfo(symbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/options/{symbol}:
 *   get:
 *     description: To get options chain of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a options chain of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/options/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        res.json(await nseIndia.getEquityOptionChain(symbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/intraday/{symbol}:
 *   get:
 *     description: To get intraday trade info of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a intraday trade info of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/intraday/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        const data = await nseIndia.getEquityIntradayData(symbol);
        res.json(data);
    } catch (error) {
        sendRouteError(res, error);
    }
})

/**
 * @openapi
 * /api/equity/historical/{symbol}:
 *   get:
 *     description: To get details of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *       - name: dateStart
 *         in: query
 *         description: "Start date to pull historical data (format: YYYY-MM-DD)"
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - name: dateEnd
 *         in: query
 *         description: "End date to pull historical data (format: YYYY-MM-DD)"
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Returns a historical data of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/historical/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        const dateStart = req.query.dateStart as string
        const dateEnd = req.query.dateEnd as string
        if (dateStart) {
            const start = new Date(dateStart)
            const end = dateEnd ? new Date(dateEnd) : new Date()
            if (start.getTime() > 0 && end.getTime() > 0) {
                const range = {
                    start,
                    end
                }
                res.json(await nseIndia.getEquityHistoricalData(symbol, range))
            } else {
                res.status(400).json({ error: 'Invalid date format. Please use the format (YYYY-MM-DD)' })
            }
        } else {
            res.json(await nseIndia.getEquityHistoricalData(symbol))
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/technicalIndicators/{symbol}:
 *   get:
 *     description: To get technical indicators for the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *       - name: period
 *         in: query
 *         description: "Number of days for historical data (default: 200)"
 *         required: false
 *         schema:
 *           type: integer
 *           default: 200
 *       - name: smaPeriods
 *         in: query
 *         description: "Comma-separated SMA periods (e.g., 5,10,20,50)"
 *         required: false
 *         schema:
 *           type: string
 *           default: "5,10,20,50,100,200"
 *       - name: emaPeriods
 *         in: query
 *         description: "Comma-separated EMA periods (e.g., 5,10,20,50)"
 *         required: false
 *         schema:
 *           type: string
 *           default: "5,10,20,50,100,200"
 *       - name: rsiPeriod
 *         in: query
 *         description: "RSI period (default: 14)"
 *         required: false
 *         schema:
 *           type: integer
 *           default: 14
 *       - name: bbPeriod
 *         in: query
 *         description: "Bollinger Bands period (default: 20)"
 *         required: false
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: bbStdDev
 *         in: query
 *         description: "Bollinger Bands standard deviation (default: 2)"
 *         required: false
 *         schema:
 *           type: number
 *           default: 2
 *       - name: showOnlyLatest
 *         in: query
 *         description: "Show only latest values (true) or all values (false) - useful for charts (default: true)"
 *         required: false
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Returns technical indicators for the NSE symbol
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sma:
 *                   type: object
 *                   description: "Simple Moving Averages with dynamic keys (sma5, sma10, etc.)"
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: number
 *                 ema:
 *                   type: object
 *                   description: "Exponential Moving Averages with dynamic keys (ema5, ema10, etc.)"
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: number
 *                 rsi:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Relative Strength Index"
 *                 macd:
 *                   type: object
 *                   properties:
 *                     macd:
 *                       type: array
 *                       items:
 *                         type: number
 *                     signal:
 *                       type: array
 *                       items:
 *                         type: number
 *                     histogram:
 *                       type: array
 *                       items:
 *                         type: number
 *                 bollingerBands:
 *                   type: object
 *                   properties:
 *                     upper:
 *                       type: array
 *                       items:
 *                         type: number
 *                     middle:
 *                       type: array
 *                       items:
 *                         type: number
 *                     lower:
 *                       type: array
 *                       items:
 *                         type: number
 *                 stochastic:
 *                   type: object
 *                   properties:
 *                     k:
 *                       type: array
 *                       items:
 *                         type: number
 *                     d:
 *                       type: array
 *                       items:
 *                         type: number
 *                 williamsR:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Williams %R"
 *                 atr:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Average True Range"
 *                 adx:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Average Directional Index"
 *                 obv:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "On-Balance Volume"
 *                 cci:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Commodity Channel Index"
 *                 mfi:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Money Flow Index"
 *                 roc:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Rate of Change"
 *                 momentum:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Momentum"
 *                 ad:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Accumulation/Distribution"
 *                 vwap:
 *                   type: array
 *                   items:
 *                     type: number
 *                   description: "Volume Weighted Average Price"
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/technicalIndicators/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        const {
            period,
            smaPeriods,
            emaPeriods,
            rsiPeriod,
            bbPeriod,
            bbStdDev,
            showOnlyLatest
        } = req.query

        // Parse query parameters
        const options: TechnicalIndicatorOptions = {}

        if (period) {
            options.period = parseInt(period as string)
        }

        if (smaPeriods) {
            options.smaPeriods = (smaPeriods as string).split(',').map(p => parseInt(p.trim()))
        }

        if (emaPeriods) {
            options.emaPeriods = (emaPeriods as string).split(',').map(p => parseInt(p.trim()))
        }

        if (rsiPeriod) {
            options.rsiPeriod = parseInt(rsiPeriod as string)
        }

        if (bbPeriod) {
            options.bbPeriod = parseInt(bbPeriod as string)
        }

        if (bbStdDev) {
            options.bbStdDev = parseFloat(bbStdDev as string)
        }

        const indicators = await nseIndia.getTechnicalIndicators(symbol, (options.period as number) || 200, options)

        // Parse showOnlyLatest flag (default: true)
        const showLatest = showOnlyLatest === undefined || showOnlyLatest === 'true'

        if (showLatest) {
            res.json(formatLatestIndicators(indicators))
        } else {
            res.json(formatAllIndicators(indicators))
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/equity/{symbol}:
 *   get:
 *     description: To get details of the NSE symbol
 *     tags:
 *       - Equity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: path
 *         description: NSE Symbol of the Equity
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a details of the NSE symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/equity/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid symbol format' })
        }
        const data = await nseIndia.getEquityDetails(symbol);
        res.json(data);
    } catch (error) {
        sendRouteError(res, error);
    }
})

/**
 * @openapi
 * /api/index/{indexSymbol}:
 *   get:
 *     description: To get detailsof the NSE index
 *     tags:
 *       - Index
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: indexSymbol
 *         in: path
 *         description: NSE index symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a details of the NSE index symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/index/:indexSymbol', async (req, res) => {
    try {
        res.json(await nseIndia.getEquityStockIndices(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})




/**
 * @openapi
 * /api/index/options/{indexSymbol}:
 *   get:
 *     description: To get index Option chain data
 *     tags:
 *       - Index
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: indexSymbol
 *         in: path
 *         description: NSE index symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns Data for Index OPTION CHAIN
 *       400:
 *         description: Returns a JSON error object of API call
 */

mainRouter.get('/api/index/options/:indexSymbol', async (req, res) => {
    try {
        res.json(await nseIndia.getIndexOptionChain(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @swagger
 * /api/index/options/contract-info/{indexSymbol}:
 *   get:
 *     summary: Get option chain contract information for an index
 *     tags: [Index]
 *     parameters:
 *       - in: path
 *         name: indexSymbol
 *         required: true
 *         schema:
 *           type: string
 *         description: Index symbol (e.g., NIFTY, BANKNIFTY)
 *     responses:
 *       200:
 *         description: Returns option chain contract information (expiry dates and strike prices)
 *       400:
 *         description: Returns a JSON error object of API call
 */

mainRouter.get('/api/index/options/contract-info/:indexSymbol', async (req, res) => {
    try {
        res.json(await nseIndia.getIndexOptionChainContractInfo(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})


/**
 * @openapi
 * /api/commodity/options/{commoditySymbol}:
 *   get:
 *     description: To get commodity Option chain data
 *     tags:
 *       - Commodity
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: commoditySymbol
 *         in: path
 *         description: NSE commodity symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a option chain data of the NSE commodity symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */

mainRouter.get('/api/commodity/options/:commoditySymbol', async (req, res) => {
    try {
        res.json(await nseIndia.getCommodityOptionChain(req.params.commoditySymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/index/intraday/{indexSymbol}:
 *   get:
 *     description: To get intraday trade info of the NSE index symbol
 *     tags:
 *       - Index
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: indexSymbol
 *         in: path
 *         description: NSE index symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     responses:
 *       200:
 *         description: Returns a intraday trade info of the NSE index symbol
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/index/intraday/:indexSymbol', async (req, res) => {
    try {
        res.json(await nseIndia.getIndexIntradayData(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/gainersAndLosers/{indexSymbol}:
 *   get:
 *     description: To get gainers and losers of the specific index
 *     tags:
 *       - Helpers
 *     parameters:
 *       - name: indexSymbol
 *         in: path
 *         description: NSE index symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of the specified index's gainers and losers
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/gainersAndLosers/:indexSymbol', async (req, res) => {
    try {
        res.json(await getGainersAndLosersByIndex(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mostActive/{indexSymbol}:
 *   get:
 *     description: To get most active equities of the specific index
 *     tags:
 *       - Helpers
 *     parameters:
 *       - name: indexSymbol
 *         in: path
 *         description: NSE index symbol
 *         required: true
 *         schema:
 *           type: string
 *           format: any
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Returns a JSON object of most active equities of the specified index
 *       400:
 *         description: Returns a JSON error object of API call
 */
mainRouter.get('/api/mostActive/:indexSymbol', async (req, res) => {
    try {
        res.json(await getMostActiveEquities(req.params.indexSymbol))
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/charts/equity-historical-data:
 *   get:
 *     description: Get historical chart data from charting.nseindia.com for equity symbols
 *     tags:
 *       - Charting
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: query
 *         description: Equity symbol with series code (e.g., 'ONGC')
 *         required: true
 *         schema:
 *           type: string
 *           example: ONGC
 *       - name: start
 *         in: query
 *         description: >
 *           Start date/time. Supports YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, unix timestamp
 *           (seconds or milliseconds)
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-04-10 09:15:00"
 *       - name: end
 *         in: query
 *         description: >
 *           End date/time. Supports YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, unix timestamp
 *           (seconds or milliseconds)
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-04-12 15:30:00"
 *       - name: token
 *         in: query
 *         description: Optional token value for charting API (auto-fetched when omitted)
 *         required: false
 *         schema:
 *           type: string
 *           example: "2475"
 *       - name: symbolType
 *         in: query
 *         description: Type of symbol (e.g., 'Equity', 'Index')
 *         required: false
 *         schema:
 *           type: string
 *           default: Equity
 *           example: Equity
 *       - name: chartType
 *         in: query
 *         description: Chart type ('I' for intraday, 'D' for daily pattern, etc.)
 *         required: false
 *         schema:
 *           type: string
 *           default: I
 *           example: I
 *       - name: timeInterval
 *         in: query
 *         description: Time interval in minutes (e.g., '5', '15', '60')
 *         required: false
 *         schema:
 *           type: string
 *           default: "5"
 *           example: "5"
 *     responses:
 *       200:
 *         description: Returns historical chart data with OHLC values and timestamps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: boolean
 *                   description: true if request was successful
 *                   example: true
 *                 data:
 *                   type: array
 *                   description: Array of candle data points
 *                   items:
 *                     type: object
 *                     properties:
 *                       volume:
 *                         type: number
 *                         example: 46151
 *                       high:
 *                         type: number
 *                         example: 286.7
 *                       low:
 *                         type: number
 *                         example: 286.3
 *                       time:
 *                         type: number
 *                         description: Unix timestamp in milliseconds
 *                         example: 1775834999000
 *                       close:
 *                         type: number
 *                         example: 286.7
 *                       open:
 *                         type: number
 *                         example: 286.65
 *       400:
 *         description: Returns error object if API call fails or parameters are invalid
 */
mainRouter.get('/api/charts/equity-historical-data', async (req, res) => {
    try {
        const {
            symbol,
            start,
            end,
            token,
            symbolType = 'Equity',
            chartType = 'I',
            timeInterval = '5'
        } = req.query

        if (!symbol || typeof symbol !== 'string' || !isValidSymbol(symbol.toUpperCase())) {
            return res.status(400).json({ error: 'Missing or invalid symbol parameter' })
        }
        if (chartType && !['I', 'D'].includes(chartType as string)) {
            return res.status(400).json({ error: 'chartType must be I or D' })
        }
        if (timeInterval) {
            const interval = parseInt(timeInterval as string, 10)
            if (!Number.isInteger(interval) || interval <= 0) {
                return res.status(400).json({ error: 'timeInterval must be a positive integer' })
            }
        }
        // Call the charting method
        const parseChartDateParam = (value: unknown): Date => {
            const input = String(value).trim()
            const numeric = Number(input)
            // Accept unix timestamp in seconds (10 digits) or milliseconds (13 digits).
            if (!Number.isNaN(numeric) && input !== '') {
                const unixMs = input.length <= 10 ? numeric * 1000 : numeric
                return new Date(unixMs)
            }
            return new Date(input)
        }

        let range
        if (start || end) {
            const endDate = end ? parseChartDateParam(end) : new Date()
            const startDate = start
                ? parseChartDateParam(start)
                : new Date(endDate.getTime() - 24 * 60 * 60 * 1000)
            if (!(startDate.getTime() > 0 && endDate.getTime() > 0)) {
                return res.status(400).json({
                    error: 'Invalid date format. Use YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, or unix timestamp'
                })
            }
            range = {
                start: startDate,
                end: endDate
            }
        }

        const chartData = await nseIndia.getEquityChartHistoricalData(
            String(symbol),
            range,
            token ? String(token) : undefined,
            String(symbolType),
            String(chartType),
            String(timeInterval)
        )

        res.json(chartData)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/charts/symbol-info:
 *   get:
 *     description: >
 *       Look up NSE charting symbol information (including scripCode / token) for a
 *       given equity symbol. The returned `scripCode` is the value that must be passed
 *       as `token` to the `/api/charts/equity-historical-data` endpoint.
 *     tags:
 *       - Charting
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: symbol
 *         in: query
 *         description: Equity symbol with or without series code (e.g., 'ONGC' or 'ONGC')
 *         required: true
 *         schema:
 *           type: string
 *           example: ONGC
 *       - name: segment
 *         in: query
 *         description: Optional market segment filter (leave empty to search all segments)
 *         required: false
 *         schema:
 *           type: string
 *           example: ''
 *     responses:
 *       200:
 *         description: Returns charting symbol information including scripCode (token)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 symbol:
 *                   type: string
 *                   example: ONGC
 *                 scripCode:
 *                   type: string
 *                   description: The token value required by the historical chart API
 *                   example: "2475"
 *                 companyName:
 *                   type: string
 *                 isin:
 *                   type: string
 *                 segment:
 *                   type: string
 *                 series:
 *                   type: string
 *                 status:
 *                   type: string
 *       400:
 *         description: Returns error if symbol is missing or lookup fails
 */
mainRouter.get('/api/charts/symbol-info', async (req, res) => {
    try {
        const { symbol, segment = '' } = req.query

        if (!symbol) {
            return res.status(400).json({ error: 'Missing required parameter: symbol' })
        }

        const symbolInfo = await nseIndia.getEquitySymbolInfo(String(symbol), String(segment))
        res.json(symbolInfo)
    } catch (error) {
        sendRouteError(res, error)
    }
})



// ============================================================================
// MCP CLIENT - CORE ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /api/mcp/query:
 *   post:
 *     description: Query NSE India data using natural language. Supports OpenAI function calling,
 *       memory, context summarization, and session management.
 *     tags:
 *       - MCP Client
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Natural language query about NSE India stock market data
 *                 example: "What is the current price of TCS stock? Also compare it with RELIANCE."
 *               sessionId:
 *                 type: string
 *                 description: Optional session identifier for memory features
 *                 example: "user123_session456"
 *               userId:
 *                 type: string
 *                 description: Optional user identifier for personalization
 *                 example: "user123"
 *               model:
 *                 type: string
 *                 description: OpenAI model to use
 *                 default: gpt-4o-mini
 *               temperature:
 *                 type: number
 *                 description: Temperature for response generation
 *                 default: 0.7
 *               max_tokens:
 *                 type: number
 *                 description: Maximum tokens in response
 *                 default: 2000
 *               includeContext:
 *                 type: boolean
 *                 description: Whether to include conversation context (requires sessionId)
 *                 default: true
 *               updatePreferences:
 *                 type: boolean
 *                 description: Whether to update user preferences based on query (requires sessionId)
 *                 default: true
 *               useMemory:
 *                 type: boolean
 *                 description: Whether to use memory features (requires sessionId)
 *                 default: true
 *               maxIterations:
 *                 type: number
 *                 description: Maximum number of iterations for complex queries
 *                 default: 5
 *               enableDebugLogging:
 *                 type: boolean
 *                 description: Enable debug logging for AI messages and tool calls
 *                 default: false
 *     responses:
 *       200:
 *         description: Returns AI-generated response with NSE data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                   description: AI-generated response
 *                 tools_used:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of unique MCP tools used across all iterations
 *                 data_sources:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Data sources used
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Response timestamp
 *                 sessionId:
 *                   type: string
 *                   description: Session identifier (if memory was used)
 *                 context_used:
 *                   type: boolean
 *                   description: Whether context was used
 *                 user_preferences_updated:
 *                   type: boolean
 *                   description: Whether user preferences were updated
 *                 conversation_length:
 *                   type: number
 *                   description: Current conversation length
 *                 context_summarized:
 *                   type: boolean
 *                   description: Whether context was summarized
 *                 context_summary:
 *                   type: object
 *                   description: Context summary (if summarized)
 *                 token_count:
 *                   type: object
 *                   description: Token count information
 *                 iterations_used:
 *                   type: number
 *                   description: Number of iterations used to process the query
 *                 iteration_details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       iteration:
 *                         type: number
 *                       tools_called:
 *                         type: array
 *                         items:
 *                           type: string
 *                       purpose:
 *                         type: string
 *                       tool_parameters:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             tool_name:
 *                               type: string
 *                             parameters:
 *                               type: object
 *                   description: Detailed breakdown of each iteration including tool parameters
 *       400:
 *         description: Returns error if query processing fails
 *       500:
 *         description: Returns error if OpenAI API fails
 */
mainRouter.post('/api/mcp/query', async (req, res) => {
    try {
        let {
            query,
            sessionId: providedSessionId,
            userId,
            model,
            temperature,
            max_tokens,
            includeContext,
            updatePreferences,
            useMemory,
            maxIterations,
            enableDebugLogging,
            regenerate
        } = req.body as MCPClientRequest

        if ((!query || typeof query !== 'string') && providedSessionId && regenerate) {
            const history = getMcpClient().getConversationHistory(providedSessionId)
            for (let i = history.length - 1; i >= 0; i--) {
                if (history[i].role === 'user') {
                    query = history[i].content
                    break
                }
            }
        }
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: 'Query is required and must be a string'
            })
        }

        if (temperature !== undefined && (typeof temperature !== 'number' || temperature < 0 || temperature > 2)) {
            return res.status(400).json({ error: 'temperature must be a number between 0 and 2' })
        }
        if (max_tokens !== undefined && (!Number.isInteger(max_tokens) || max_tokens <= 0)) {
            return res.status(400).json({ error: 'max_tokens must be a positive integer' })
        }
        if (maxIterations !== undefined && (!Number.isInteger(maxIterations) || maxIterations <= 0)) {
            return res.status(400).json({ error: 'maxIterations must be a positive integer' })
        }

        // Generate sessionId if not provided to enable memory features
        const sessionId = providedSessionId || `auto_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            return res.status(500).json({
                error: 'API key not configured.'
            })
        }
        if (!validateApiKey(apiKey)) {
            return res.status(500).json({
                error: 'API key is invalid.'
            })
        }

        // Enable debug logging if requested, or check environment variable
        const shouldEnableDebug = enableDebugLogging || process.env.MCP_DEBUG_LOGGING === 'true'

        // Store original debug state to restore later
        const originalDebugState = getMcpClient().isDebugLoggingEnabled()

        // Temporarily enable debug logging if requested
        if (shouldEnableDebug) {
            getMcpClient().setDebugLogging(true)
        }

        try {
            const result = await getMcpClient().processQuery({
                query,
                sessionId,
                userId,
                model,
                temperature,
                max_tokens,
                includeContext,
                updatePreferences,
                useMemory,
                maxIterations
            })

            res.json(result)
        } finally {
            // Restore original debug state
            getMcpClient().setDebugLogging(originalDebugState)
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/tools:
 *   get:
 *     description: Get list of available MCP tools for NSE India data
 *     tags:
 *       - MCP Client
 *     responses:
 *       200:
 *         description: Returns list of available MCP tools
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tools:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Tool name
 *                       description:
 *                         type: string
 *                         description: Tool description
 *                       inputSchema:
 *                         type: object
 *                         description: Tool input schema
 *       500:
 *         description: Returns error if tools cannot be retrieved
 */
mainRouter.get('/api/mcp/tools', async (_req, res) => {
    try {
        const tools = getMcpClient().getAvailableTools()
        res.json({ tools })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/test:
 *   get:
 *     description: Test MCP client connection and OpenAI integration
 *     tags:
 *       - MCP Client
 *     responses:
 *       200:
 *         description: Returns test result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   description: Test status
 *                 message:
 *                   type: string
 *                   description: Test message
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   description: Test timestamp
 *       500:
 *         description: Returns error if test fails
 */
mainRouter.get('/api/mcp/test', async (_req, res) => {
    try {
        const testApiKey = process.env.OPENAI_API_KEY
        if (!testApiKey) {
            return res.status(500).json({
                status: 'error',
                message: 'API key not configured.',
                openaiConfigured: false,
                timestamp: new Date().toISOString()
            })
        }
        if (!validateApiKey(testApiKey)) {
            return res.status(500).json({
                status: 'error',
                message: 'API key is invalid.',
                openaiConfigured: false,
                timestamp: new Date().toISOString()
            })
        }

        const isConnected = await getMcpClient().testConnection()

        if (isConnected) {
            res.json({
                status: 'ok',
                openaiConfigured: true,
                message: 'MCP client is working correctly',
                timestamp: new Date().toISOString()
            })
        } else {
            res.status(500).json({
                status: 'error',
                openaiConfigured: true,
                message: 'MCP client test failed',
                timestamp: new Date().toISOString()
            })
        }
    } catch (error) {
        sendRouteError(res, error)
    }
})

// ============================================================================
// MCP CLIENT - UTILITY ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /api/mcp/functions:
 *   get:
 *     description: Get list of available MCP tools in OpenAI function format
 *     tags:
 *       - MCP Client
 *     responses:
 *       200:
 *         description: Returns list of available MCP tools in OpenAI function format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 functions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         description: Function name
 *                       description:
 *                         type: string
 *                         description: Function description
 *                       parameters:
 *                         type: object
 *                         description: Function parameters schema
 *       500:
 *         description: Returns error if functions cannot be retrieved
 */
mainRouter.get('/api/mcp/functions', async (_req, res) => {
    try {
        const functions = getMcpClient().getOpenAIFunctions()
        res.json({ functions })
    } catch (error) {
        sendRouteError(res, error)
    }
})

// ============================================================================
// MCP CLIENT - SESSION MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /api/mcp/session/{sessionId}:
 *   get:
 *     description: Get session information and statistics
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns session information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 startTime:
 *                   type: string
 *                   format: date-time
 *                 lastActivity:
 *                   type: string
 *                   format: date-time
 *                 messageCount:
 *                   type: number
 *                 recentQueriesCount:
 *                   type: number
 *                 frequentlyAccessedStocks:
 *                   type: number
 *                 frequentlyUsedTools:
 *                   type: number
 *       404:
 *         description: Session not found
 */
mainRouter.get('/api/mcp/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params
        const sessionInfo = getMcpClient().getSessionInfo(sessionId)

        if (!sessionInfo) {
            return res.status(404).json({
                error: 'Session not found'
            })
        }

        res.json(sessionInfo)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/history:
 *   get:
 *     description: Get conversation history for a session
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *       - name: maxMessages
 *         in: query
 *         description: Maximum number of messages to return
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Returns conversation history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         enum: [user, assistant, system]
 *                       content:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       tools_used:
 *                         type: array
 *                         items:
 *                           type: string
 *                       metadata:
 *                         type: object
 *       404:
 *         description: Session not found
 */
mainRouter.get('/api/mcp/session/:sessionId/history', async (req, res) => {
    try {
        const { sessionId } = req.params
        const { maxMessages } = req.query

        const history = getMcpClient().getConversationHistory(
            sessionId,
            maxMessages ? parseInt(maxMessages as string) : undefined
        )

        if (history.length === 0) {
            return res.status(404).json({
                error: 'Session not found or no history available'
            })
        }

        res.json({ messages: history })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/preferences:
 *   put:
 *     description: Update user preferences for a session
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferredStocks:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of preferred stock symbols
 *               preferredIndices:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of preferred indices
 *               analysisStyle:
 *                 type: string
 *                 enum: [detailed, brief, technical]
 *                 description: Preferred analysis style
 *               language:
 *                 type: string
 *                 description: Preferred language
 *               timezone:
 *                 type: string
 *                 description: User timezone
 *               notificationSettings:
 *                 type: object
 *                 properties:
 *                   priceAlerts:
 *                     type: boolean
 *                   marketUpdates:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid preferences data
 *       404:
 *         description: Session not found
 */
mainRouter.put('/api/mcp/session/:sessionId/preferences', async (req, res) => {
    try {
        const { sessionId } = req.params
        const preferences = req.body

        getMcpClient().updateUserPreferences(sessionId, preferences)

        res.json({
            message: 'Preferences updated successfully',
            sessionId
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/clear:
 *   delete:
 *     description: Clear session data and conversation history
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session cleared successfully
 *       404:
 *         description: Session not found
 */
mainRouter.delete('/api/mcp/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params
        getMcpClient().clearSession(sessionId)
        res.json({
            message: 'Session deleted successfully',
            sessionId
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

mainRouter.delete('/api/mcp/session/:sessionId/clear', async (req, res) => {
    try {
        const { sessionId } = req.params

        getMcpClient().clearSession(sessionId)

        res.json({
            message: 'Session cleared successfully',
            sessionId
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/export:
 *   get:
 *     description: Export session data
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns exported session data
 *       404:
 *         description: Session not found
 */
mainRouter.get('/api/mcp/session/:sessionId/export', async (req, res) => {
    try {
        const { sessionId } = req.params
        const sessionData = getMcpClient().exportSessionData(sessionId)

        if (!sessionData) {
            return res.status(404).json({
                error: 'Session not found'
            })
        }

        res.json(sessionData)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/cleanup:
 *   post:
 *     description: Cleanup expired sessions
 *     tags:
 *       - MCP Client
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
mainRouter.post('/api/mcp/cleanup', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] as string || process.env.OPENAI_API_KEY
        if (!apiKey || !validateApiKey(apiKey)) {
            return res.status(401).json({ error: 'Invalid or missing API key' })
        }
        getMcpClient().cleanupExpiredSessions()

        res.json({
            message: 'Cleanup completed successfully',
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/sessions:
 *   get:
 *     description: List all MCP sessions
 *     tags:
 *       - MCP Client
 *     responses:
 *       200:
 *         description: Returns list of sessions
 */
mainRouter.get('/api/mcp/sessions', async (req, res) => {
    try {
        const sessions = getMcpClient().getAllSessions()
        res.json({ sessions })
    } catch (error) {
        sendRouteError(res, error)
    }
})

// ============================================================================
// MCP CLIENT - CONTEXT MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /api/mcp/session/{sessionId}/context-stats:
 *   get:
 *     description: Get context statistics for a session
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns context statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 messageCount:
 *                   type: number
 *                   description: Number of messages in conversation
 *                 tokenCount:
 *                   type: object
 *                   description: Token count breakdown
 *                 needsSummarization:
 *                   type: boolean
 *                   description: Whether context needs summarization
 *                 contextWindowUsage:
 *                   type: number
 *                   description: Context window usage percentage
 *       404:
 *         description: Session not found
 */
mainRouter.get('/api/mcp/session/:sessionId/context-stats', async (req, res) => {
    try {
        const { sessionId } = req.params
        const stats = await getMcpClient().getContextStats(sessionId)

        res.json(stats)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/summarize:
 *   post:
 *     description: Force context summarization for a session
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Context summarization completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   description: Generated context summary
 *                 message:
 *                   type: string
 *                   description: Success message
 *       404:
 *         description: Session not found
 */
mainRouter.post('/api/mcp/session/:sessionId/summarize', async (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'] as string || process.env.OPENAI_API_KEY
        if (!apiKey || !validateApiKey(apiKey)) {
            return res.status(401).json({ error: 'Invalid or missing API key' })
        }
        const { sessionId } = req.params
        const summary = await getMcpClient().forceContextSummarization(sessionId)

        if (!summary) {
            return res.status(404).json({
                error: 'Session not found'
            })
        }

        res.json({
            summary,
            message: 'Context summarization completed successfully'
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/context-window:
 *   get:
 *     description: Get context window configuration
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns context window configuration
 */
mainRouter.get('/api/mcp/session/:sessionId/context-window', async (req, res) => {
    try {
        const config = getMcpClient().getContextWindowConfig()
        res.json(config)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/context-window:
 *   put:
 *     description: Update context window configuration
 *     tags:
 *       - MCP Client
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         description: Session identifier
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxTokens:
 *                 type: number
 *                 description: Maximum tokens in context window
 *               reservedTokens:
 *                 type: number
 *                 description: Reserved tokens for system prompt and response
 *               summarizationThreshold:
 *                 type: number
 *                 description: Threshold for triggering summarization (0-1)
 *               minMessagesToSummarize:
 *                 type: number
 *                 description: Minimum messages before summarization
 *               summaryCompressionRatio:
 *                 type: number
 *                 description: Compression ratio for summaries (0-1)
 *     responses:
 *       200:
 *         description: Context window configuration updated
 */
mainRouter.put('/api/mcp/session/:sessionId/context-window', async (req, res) => {
    try {
        const config = req.body
        getMcpClient().updateContextWindowConfig(config)

        res.json({
            message: 'Context window configuration updated successfully',
            config: getMcpClient().getContextWindowConfig()
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

// ============================================================================
// SUMMARIZATION HISTORY ENDPOINTS
// ============================================================================

/**
 * @openapi
 * /api/mcp/session/{sessionId}/summarization/last:
 *   get:
 *     description: Get the last summarization details for a session
 *     tags:
 *       - MCP Memory
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       200:
 *         description: Returns last summarization details
 *       404:
 *         description: No summarization found
 */
mainRouter.get('/api/mcp/session/:sessionId/summarization/last', async (req, res) => {
    try {
        const { sessionId } = req.params

        if (!getMcpClient().isMemoryEnabled()) {
            return res.status(500).json({ error: 'Memory manager not enabled' })
        }

        const lastSummarization = getMcpClient().getLastSummarization(sessionId)

        if (!lastSummarization) {
            return res.status(404).json({
                message: 'No summarization found for this session'
            })
        }

        res.json(lastSummarization)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/summarization/history:
 *   get:
 *     description: Get summarization history for a session
 *     tags:
 *       - MCP Memory
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Limit number of records returned
 *     responses:
 *       200:
 *         description: Returns summarization history
 */
mainRouter.get('/api/mcp/session/:sessionId/summarization/history', async (req, res) => {
    try {
        const { sessionId } = req.params
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined

        if (!getMcpClient().isMemoryEnabled()) {
            return res.status(500).json({ error: 'Memory manager not enabled' })
        }

        const history = getMcpClient().getSummarizationHistory(sessionId, limit)

        res.json({
            sessionId,
            count: history.length,
            history
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/summarization/summary:
 *   get:
 *     description: Get summarization summary (overview without full message history)
 *     tags:
 *       - MCP Memory
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       200:
 *         description: Returns summarization summary
 */
mainRouter.get('/api/mcp/session/:sessionId/summarization/summary', async (req, res) => {
    try {
        const { sessionId } = req.params

        if (!getMcpClient().isMemoryEnabled()) {
            return res.status(500).json({ error: 'Memory manager not enabled' })
        }

        const summary = getMcpClient().getSummarizationSummary(sessionId)

        if (!summary) {
            return res.status(404).json({
                message: 'Session not found'
            })
        }

        res.json(summary)
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/session/{sessionId}/openai-messages:
 *   get:
 *     description: Get the exact messages that would be sent to OpenAI (including system message)
 *     tags:
 *       - MCP Memory
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       200:
 *         description: Returns messages in OpenAI format
 */
mainRouter.get('/api/mcp/session/:sessionId/openai-messages', async (req, res) => {
    try {
        const { sessionId } = req.params

        if (!getMcpClient().isMemoryEnabled()) {
            return res.status(500).json({ error: 'Memory manager not enabled' })
        }

        const data = getMcpClient().getOpenAIMessages(sessionId)

        if (!data) {
            return res.status(404).json({ error: 'Session not found' })
        }

        // Format messages as they would be sent to OpenAI
        const openaiMessages = [
            {
                role: 'system',
                content: data.systemPrompt,
                metadata: {
                    type: 'system_prompt',
                    includes_user_context: true
                }
            },
            ...data.conversationHistory.map((msg: any) => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                metadata: {
                    ...msg.metadata,
                    is_summary: msg.metadata?.isSummary || false,
                    tools_used: msg.tools_used || []
                }
            }))
        ]

        // Calculate statistics
        const summaryMessages = openaiMessages.filter(
            m => m.metadata && 'is_summary' in m.metadata && m.metadata.is_summary
        )
        const stats = {
            total_messages: openaiMessages.length,
            system_messages: 1,
            summary_messages: summaryMessages.length,
            user_messages: openaiMessages.filter(m => m.role === 'user').length,
            assistant_messages: openaiMessages.filter(m => m.role === 'assistant').length
        }

        res.json({
            sessionId,
            messages: openaiMessages,
            statistics: stats,
            note: 'This is exactly what OpenAI would receive for the next query'
        })
    } catch (error) {
        sendRouteError(res, error)
    }
})

/**
 * @openapi
 * /api/mcp/config:
 *   post:
 *     description: Update MCP debug configuration
 *     tags:
 *       - MCP Client
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               debugLogging:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Config updated successfully
 */
mainRouter.post('/api/mcp/config', async (req, res) => {
    try {
        const { debugLogging } = req.body
        if (typeof debugLogging === 'boolean') {
            process.env.MCP_DEBUG_LOGGING = String(debugLogging)
        }
        res.json({ message: 'Config updated', restartRequired: false })
    } catch (error) {
        sendRouteError(res, error)
    }
})

export { mainRouter }
