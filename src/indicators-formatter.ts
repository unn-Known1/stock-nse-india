import { TechnicalIndicators } from './interface'

export function roundTo2Decimals(value: number | null | undefined): number | null {
  return value != null ? Math.round(value * 100) / 100 : null
}

export function roundArrayTo2Decimals(arr: number[]): number[] {
  return arr.map(value => roundTo2Decimals(value) ?? 0)
}

export function formatLatestIndicators(indicators: TechnicalIndicators): Record<string, unknown> {
  const latestIndicators: Record<string, unknown> = {}

  latestIndicators.sma = {}
  Object.keys(indicators.sma).forEach(key => {
    const values = indicators.sma[key]
      ; (latestIndicators.sma as Record<string, unknown>)[key] =
        values.length > 0 ? roundTo2Decimals(values[values.length - 1]) : null
  })

  latestIndicators.ema = {}
  Object.keys(indicators.ema).forEach(key => {
    const values = indicators.ema[key]
      ; (latestIndicators.ema as Record<string, unknown>)[key] =
        values.length > 0 ? roundTo2Decimals(values[values.length - 1]) : null
  })

  latestIndicators.rsi = roundTo2Decimals(
    indicators.rsi.length > 0
      ? indicators.rsi[indicators.rsi.length - 1]
      : null
  )
  latestIndicators.macd = {
    macd: roundTo2Decimals(
      indicators.macd.macd.length > 0
        ? indicators.macd.macd[indicators.macd.macd.length - 1]
        : null
    ),
    signal: roundTo2Decimals(
      indicators.macd.signal.length > 0
        ? indicators.macd.signal[indicators.macd.signal.length - 1]
        : null
    ),
    histogram: roundTo2Decimals(
      indicators.macd.histogram.length > 0
        ? indicators.macd.histogram[indicators.macd.histogram.length - 1]
        : null
    )
  }
  latestIndicators.bollingerBands = {
    upper: roundTo2Decimals(
      indicators.bollingerBands.upper.length > 0
        ? indicators.bollingerBands.upper[indicators.bollingerBands.upper.length - 1]
        : null
    ),
    middle: roundTo2Decimals(
      indicators.bollingerBands.middle.length > 0
        ? indicators.bollingerBands.middle[indicators.bollingerBands.middle.length - 1]
        : null
    ),
    lower: roundTo2Decimals(
      indicators.bollingerBands.lower.length > 0
        ? indicators.bollingerBands.lower[indicators.bollingerBands.lower.length - 1]
        : null
    )
  }
  latestIndicators.stochastic = {
    k: roundTo2Decimals(
      indicators.stochastic.k.length > 0
        ? indicators.stochastic.k[indicators.stochastic.k.length - 1]
        : null
    ),
    d: roundTo2Decimals(
      indicators.stochastic.d.length > 0
        ? indicators.stochastic.d[indicators.stochastic.d.length - 1]
        : null
    )
  }
  latestIndicators.williamsR = roundTo2Decimals(
    indicators.williamsR.length > 0
      ? indicators.williamsR[indicators.williamsR.length - 1]
      : null
  )
  latestIndicators.atr = roundTo2Decimals(
    indicators.atr.length > 0
      ? indicators.atr[indicators.atr.length - 1]
      : null
  )
  latestIndicators.adx = roundTo2Decimals(
    indicators.adx.length > 0
      ? indicators.adx[indicators.adx.length - 1]
      : null
  )
  latestIndicators.obv = roundTo2Decimals(
    indicators.obv.length > 0
      ? indicators.obv[indicators.obv.length - 1]
      : null
  )
  latestIndicators.cci = roundTo2Decimals(
    indicators.cci.length > 0
      ? indicators.cci[indicators.cci.length - 1]
      : null
  )
  latestIndicators.mfi = roundTo2Decimals(
    indicators.mfi.length > 0
      ? indicators.mfi[indicators.mfi.length - 1]
      : null
  )
  latestIndicators.roc = roundTo2Decimals(
    indicators.roc.length > 0
      ? indicators.roc[indicators.roc.length - 1]
      : null
  )
  latestIndicators.momentum = roundTo2Decimals(
    indicators.momentum.length > 0
      ? indicators.momentum[indicators.momentum.length - 1]
      : null
  )
  latestIndicators.ad = roundTo2Decimals(
    indicators.ad.length > 0
      ? indicators.ad[indicators.ad.length - 1]
      : null
  )
  latestIndicators.vwap = roundTo2Decimals(
    indicators.vwap.length > 0
      ? indicators.vwap[indicators.vwap.length - 1]
      : null
  )

  return latestIndicators
}

export function formatAllIndicators(indicators: TechnicalIndicators): Record<string, unknown> {
  const roundedIndicators: Record<string, unknown> = {}

  roundedIndicators.sma = {}
  Object.keys(indicators.sma).forEach(key => {
    (roundedIndicators.sma as Record<string, unknown>)[key] =
      roundArrayTo2Decimals(indicators.sma[key])
  })

  roundedIndicators.ema = {}
  Object.keys(indicators.ema).forEach(key => {
    (roundedIndicators.ema as Record<string, unknown>)[key] =
      roundArrayTo2Decimals(indicators.ema[key])
  })

  roundedIndicators.rsi = roundArrayTo2Decimals(indicators.rsi)
  roundedIndicators.macd = {
    macd: roundArrayTo2Decimals(indicators.macd.macd),
    signal: roundArrayTo2Decimals(indicators.macd.signal),
    histogram: roundArrayTo2Decimals(indicators.macd.histogram)
  }
  roundedIndicators.bollingerBands = {
    upper: roundArrayTo2Decimals(indicators.bollingerBands.upper),
    middle: roundArrayTo2Decimals(indicators.bollingerBands.middle),
    lower: roundArrayTo2Decimals(indicators.bollingerBands.lower)
  }
  roundedIndicators.stochastic = {
    k: roundArrayTo2Decimals(indicators.stochastic.k),
    d: roundArrayTo2Decimals(indicators.stochastic.d)
  }
  roundedIndicators.williamsR = roundArrayTo2Decimals(indicators.williamsR)
  roundedIndicators.atr = roundArrayTo2Decimals(indicators.atr)
  roundedIndicators.adx = roundArrayTo2Decimals(indicators.adx)
  roundedIndicators.obv = roundArrayTo2Decimals(indicators.obv)
  roundedIndicators.cci = roundArrayTo2Decimals(indicators.cci)
  roundedIndicators.mfi = roundArrayTo2Decimals(indicators.mfi)
  roundedIndicators.roc = roundArrayTo2Decimals(indicators.roc)
  roundedIndicators.momentum = roundArrayTo2Decimals(indicators.momentum)
  roundedIndicators.ad = roundArrayTo2Decimals(indicators.ad)
  roundedIndicators.vwap = roundArrayTo2Decimals(indicators.vwap)

  return roundedIndicators
}
