import DataLoader from 'dataloader'
import { ApiList, NseIndia } from './index'
import { EquityDetails } from './interface'

const nseIndia = new NseIndia()

const equityDetailsLoader = new DataLoader<string, EquityDetails>(
    async (symbols) => {
        const results = await Promise.allSettled(
            symbols.map((s) => nseIndia.getEquityDetails(s))
        )
        return results.map((r) => {
            if (r.status === 'rejected') {
                throw r.reason
            }
            return r.value
        })
    },
    { cache: true }
)

interface StringArrayFilter {
    startsWith?: string
    regex?: string
    in?: string[]
    nin?: string[]
    eq?: string
    neq?: string
    offset?: number
    limit?: number
}

interface ObjectFilter {
    regex?: string
}

function regexTestWithTimeout(regex: RegExp, str: string, timeoutMs = 100): boolean {
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true }, timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
    try {
        const result = regex.test(str)
        clearTimeout(timer)
        if (timedOut) {
            throw new Error(`Regex execution timed out after ${timeoutMs}ms: /${regex.source}/`)
        }
        return result
    } catch (err) {
        clearTimeout(timer)
        throw err
    }
}

function stringArrayFilter(input: string[], filter?: StringArrayFilter) {
    let data = [...input]
    const { offset, limit, eq, neq, in: inside, nin, startsWith, regex } = filter || {}
    if (startsWith) {
        data = data.filter(item => item.startsWith(startsWith))
    }
    if (regex) {
        const re = new RegExp(regex)
        data = data.filter(item => regexTestWithTimeout(re, item))
    }
    if (inside?.length) {
        data = data.filter(item => inside.includes(item))
    }
    if (nin?.length) {
        data = data.filter(item => !nin.includes(item))
    }
    if (eq) {
        data = data.filter(item => item === eq)
    }
    if (neq) {
        data = data.filter(item => item !== neq)
    }
    if (offset !== undefined) {
        data = data.filter((_, index) => index > offset)
    }
    if (limit !== undefined) {
        data = data.filter((_, index) => index < limit)
    }
    return data
}

function objectFilter(input: any, filterBy?: string, filter?: ObjectFilter) {
    const { regex } = filter || {}
    let data = [...input]
    if (regex && filterBy) {
        const re = new RegExp(regex)
        data = data.filter((item: { [x: string]: string }) => regexTestWithTimeout(re, item[filterBy]))
    }
    return data
}

export default {
    Query: {
        equities: async (_parent: unknown,
             { symbolFilter }: { symbolFilter: StringArrayFilter }): Promise<string[]> => {
            const results = await nseIndia.getAllStockSymbols()
            return stringArrayFilter(results, symbolFilter)
        },
        indices: async (_parent: unknown, { filter }: { filter: any }): Promise<any> => {
            const indices = await nseIndia.getDataByEndpoint(ApiList.ALL_INDICES)
            if (filter)
                return objectFilter(indices.data, filter.filterBy, filter.criteria)
            return indices.data
        }
    },
    Equity: {
        symbol: (parent: string): string => {
            return parent
        },
        details: (parent: string): Promise<EquityDetails> => {
            return equityDetailsLoader.load(parent)
        }
    }
}
