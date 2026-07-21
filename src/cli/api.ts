/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-console */
import { NseIndia, ApiList } from '../index.js'
import ora from 'ora'
import chalk from 'chalk'
import ohlc from 'ohlc'
import moment from 'moment'
import asciichart from 'asciichart'
import type { IndexEquityInfo } from '../interface.js'

const rupee = '₹'
const nse = new NseIndia()

interface CLIArgs {
    symbol?: string
    indexSymbol?: string
}

interface IndexOverviewItem {
    key: string
    indexSymbol: string
    last: number
    previousClose: number
    variation: number
    percentChange: number
    open: number
    high: number
    low: number
}

interface OhlcPoint {
    Close: number
    Volume: number
}

export async function showIndexOverview(): Promise<void> {
    const spinner = ora()
    spinner.text = 'Loading Indices deatils'
    spinner.start()
    const { data: allIndexData } = await nse.getDataByEndpoint(ApiList.ALL_INDICES) as { data: IndexOverviewItem[] }
    spinner.text = ''
    spinner.stop()
    const indexTypes = [
        'BROAD MARKET INDICES',
        'SECTORAL INDICES',
    ]
    indexTypes.forEach(indexType => {
        const allIndexTableData = allIndexData
            .filter((item: IndexOverviewItem) => item.key === indexType)
            .map((item: IndexOverviewItem) => {
                return {
                    'Index Symbol': item.indexSymbol,
                    'Last Price': item.last,
                    'Previous Close': item.previousClose,
                    'Change': item.variation,
                    'Change Percent': item.percentChange,
                    'Open': item.open,
                    'High': item.high,
                    'Low': item.low,
                }
            })
        console.log(`${indexType} Details`);
        console.table(allIndexTableData)
    })
}
export async function showIndexDetails(argv: CLIArgs): Promise<void> {
    const { indexSymbol: index } = argv
    const spinner = ora()
    spinner.text = `Loading ${index} Details`
    spinner.start()
    const { data } = await nse.getEquityStockIndices(index!)
    spinner.text = ''
    spinner.stop()
    if (data) {
        const indexTableData = data.map((item: IndexEquityInfo) => {
            return {
                'Symbol': item.symbol,
                'Open': item.open,
                'High': item.dayHigh,
                'Low': item.dayLow,
                'Last Price': item.lastPrice,
                'Previous Close': item.previousClose,
                'Change': Number(item.change.toFixed(2)),
                'Change Percent': item.pChange
            }
        })
        console.log(`${index} deatils`);
        console.table(indexTableData);
    } else {
        console.log(chalk.red(`${index} index symbol is invalid. Try to enclose the index symbols with quotes.`));
    }
}
export async function showMarketStatus(): Promise<void> {
    const spinner = ora()
    spinner.text = 'Loading Market status'
    spinner.start()
    const { marketState } = await nse.getDataByEndpoint(ApiList.MARKET_STATUS) as { marketState: Record<string, unknown>[] }
    spinner.text = ''
    spinner.stop()
    console.table(marketState);
}

export async function showEquityDetails(argv: CLIArgs): Promise<void> {
    const {
        symbol
    } = argv
    const spinner = ora()
    spinner.text = 'Loading Equity details'
    spinner.start()
    try {
        const {
            info,
            priceInfo,
            metadata,
            securityInfo
        } = await nse.getEquityDetails(symbol!)
        spinner.text = 'Loading Trading details'
        const {
            marketDeptOrderBook
        } = await nse.getEquityTradeInfo(symbol!)
        spinner.text = ''
        spinner.stop()
        if (info && marketDeptOrderBook) {
            const {
                tradeInfo
            } = marketDeptOrderBook
            const changePrice = Number(priceInfo.change.toFixed(2))
            const changePercent = Number(priceInfo.pChange.toFixed(2))
            const tableData: Record<string, unknown> = {
                'Last Updated Time': metadata.lastUpdateTime,
                'Symbol': symbol,
                'Company Name': info.companyName,
                'Industry': metadata.industry,
                'Sectoral Index': metadata.pdSectorInd.trim(),
                'Sectoral PE': metadata.pdSectorPe,
                'Symbol PE': metadata.pdSymbolPe,
                'Listing Status': metadata.status,
                'Listing Since': metadata.listingDate,
                [`Price Change (in ${rupee})`]: changePrice,
                'Change Percentage (in %)': changePercent,
                'Open': priceInfo.open,
                'High': priceInfo.intraDayHighLow.max,
                'Low': priceInfo.intraDayHighLow.min,
                'Close': priceInfo.close,
                'Previous Close': priceInfo.previousClose,
                'Last Traded Price': priceInfo.lastPrice,
                'Volume Weighted Average Price (VWAP)': priceInfo.vwap,
                'Total Traded Volume': tradeInfo.totalTradedVolume,
                [`Total Traded Value (${rupee} Lakhs)`]: tradeInfo.totalTradedValue,
                [`Total Market Capital (${rupee} Lakhs)`]: tradeInfo.totalMarketCap
            }

            const changeStatus = changePrice <= 0 ? `${rupee}${changePrice} (${changePercent}%)${chalk.red('▼')}` :
                `${rupee}${changePrice} (${changePercent}%)${chalk.green('▲')}`

            const derivativeStatus = securityInfo.derivatives === 'Yes' ?
                chalk.black.bgGreen(' Derivatives ') : chalk.black.bgRed(' Derivatives ')

            const slbStatus = securityInfo.slb === 'Yes' ?
                chalk.black.bgGreen(' SLB ') : chalk.black.bgRed(' SLB ')

            const ltpStatus = changePrice <= 0 ? chalk.black.bgRed(` LTP: ${priceInfo.lastPrice} `) :
                chalk.black.bgGreen(` LTP: ${priceInfo.lastPrice} `)

            console.table(tableData)
            console.log(`Change: ${changeStatus}`)
            console.log(`${ltpStatus} ${derivativeStatus} ${slbStatus}`);
        } else {
            console.log(chalk.red('Please provide valid NSE symbol.'));
        }
    } catch (error: unknown) {
        spinner.text = ''
        spinner.stop()
        console.log(chalk.red(error instanceof Error ? error.message : String(error)))
    }
}

export async function showHistorical(argv: CLIArgs): Promise<void> {
    console.time('Done In')
    const {
        symbol
    } = argv
    const spinner = ora()
    spinner.text = 'Loading Historical Data'
    spinner.start()
    const startDate = moment().subtract(3, 'months').format('YYYY-MM-DD')
    const results = await nse.getEquityHistoricalData(symbol!, { start: new Date(startDate), end: new Date() })
    spinner.text = ''
    spinner.stop()
    const ohlcData: [string, number, number, number, number, number][] = []
    results.forEach(({
        data: historicalData
    }) => {
        historicalData.forEach(info => {
            ohlcData.push([
                info.mtimestamp,
                info.chOpeningPrice,
                info.chTradeHighPrice,
                info.chTradeLowPrice,
                info.chClosingPrice,
                info.chTotTradedVal
            ])
        })
    })
    const fullOhlcData = ohlc(ohlcData)
    console.log();
    const ohlcDataFromStartDate: OhlcPoint[] = fullOhlcData.start(startDate).sma(5).toDaily()
    const CloseData = ohlcDataFromStartDate.map((obj: OhlcPoint) => obj.Close)
    const Volume = ohlcDataFromStartDate.map((obj: OhlcPoint) => obj.Volume / 100000)
    const chartConfig = {
        height: 10
    }
    console.log(chalk.black.bgCyan(' Price Chart - SMA5 (Last 3 months) '));
    console.log();
    console.log(asciichart.plot(CloseData, { ...chartConfig, colors: [asciichart.cyan] }));
    console.log();
    console.log(chalk.black.bgYellow(' Volume Chart - In Lakhs (Last 3 months) '));
    console.log();
    console.log(asciichart.plot(Volume, { ...chartConfig, colors: [asciichart.yellow] }));
    console.log();
    console.timeEnd('Done In')
}
