// File: packages/api-client/src/jse-tickers.ts
/**
 * Common JSE-listed ETFs and their descriptions.
 * This is a curated list of the most popular ETFs for the portfolio tracker.
 * Source: JSE website and major ETF providers (Satrix, CoreShares, 1nvest, etc.)
 */

export interface JSETicker {
  symbol: string
  name: string
  provider: string
  category: string
}

export const JSE_TICKERS: JSETicker[] = [
  // Satrix - Top 40 & Broad Market
  { symbol: 'STX40', name: 'Satrix Top 40', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXSWX', name: 'Satrix SWIX Top 40', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXFIN', name: 'Satrix Financials', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXIND', name: 'Satrix Industrial', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXRES', name: 'Satrix Resources', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXPRO', name: 'Satrix Property', provider: 'Satrix', category: 'SA Property' },
  { symbol: 'STXDIV', name: 'Satrix Dividend Plus', provider: 'Satrix', category: 'SA Equity' },
  { symbol: 'STXQUA', name: 'Satrix Quality', provider: 'Satrix', category: 'SA Equity' },

  // Satrix - International
  { symbol: 'STXWDM', name: 'Satrix MSCI World', provider: 'Satrix', category: 'Global Equity' },
  { symbol: 'STXEMG', name: 'Satrix MSCI Emerging Markets', provider: 'Satrix', category: 'Global Equity' },
  { symbol: 'STXNDQ', name: 'Satrix Nasdaq 100', provider: 'Satrix', category: 'Global Equity' },
  { symbol: 'STXS40', name: 'Satrix S&P 500', provider: 'Satrix', category: 'Global Equity' },
  { symbol: 'STXEUR', name: 'Satrix Euro Stoxx 50', provider: 'Satrix', category: 'Global Equity' },

  // Satrix - Bonds
  { symbol: 'STXGOV', name: 'Satrix SA Government Bonds', provider: 'Satrix', category: 'SA Bonds' },
  { symbol: 'STXILB', name: 'Satrix Inflation Linked Bonds', provider: 'Satrix', category: 'SA Bonds' },

  // CoreShares
  { symbol: 'CSEW40', name: 'CoreShares Equally Weighted Top 40', provider: 'CoreShares', category: 'SA Equity' },
  { symbol: 'CSPROP', name: 'CoreShares S&P SA Property', provider: 'CoreShares', category: 'SA Property' },
  { symbol: 'CSNDX', name: 'CoreShares S&P 500', provider: 'CoreShares', category: 'Global Equity' },

  // 1nvest (formerly Cloud Atlas)
  { symbol: 'DIVTRX', name: '1nvest MSCI World High Dividend Yield', provider: '1nvest', category: 'Global Equity' },
  { symbol: 'ASYMAX', name: '1nvest Asian Tigers', provider: '1nvest', category: 'Global Equity' },

  // Ashburton
  { symbol: 'ASHGEQ', name: 'Ashburton Global Equity', provider: 'Ashburton', category: 'Global Equity' },
  { symbol: 'ASHGLD', name: 'Ashburton Gold', provider: 'Ashburton', category: 'Commodities' },

  // NewFunds
  { symbol: 'NFEMOM', name: 'NewFunds MAPPS EM Momentum', provider: 'NewFunds', category: 'Global Equity' },
  { symbol: 'NFWDM', name: 'NewFunds MSCI World', provider: 'NewFunds', category: 'Global Equity' },

  // Sygnia
  { symbol: 'SYGEU', name: 'Sygnia Itrix MSCI Euro', provider: 'Sygnia', category: 'Global Equity' },
  { symbol: 'SYGWD', name: 'Sygnia Itrix MSCI World', provider: 'Sygnia', category: 'Global Equity' },
  { symbol: 'SYG4IR', name: 'Sygnia 4th Industrial Revolution', provider: 'Sygnia', category: 'Global Equity' },

  // Cloud Atlas (legacy)
  { symbol: 'CLOUD', name: 'Cloud Atlas AMI Big50', provider: 'Cloud Atlas', category: 'SA Equity' },

  // Absa/NewGold
  { symbol: 'NGOLD', name: 'NewGold Rand Hedge', provider: 'Absa', category: 'Commodities' },

  // StandardBank
  { symbol: 'SBPROP', name: 'StandardBank Property', provider: 'StandardBank', category: 'SA Property' },

  // Popular individual stocks (for reference)
  { symbol: 'NPN', name: 'Naspers', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'BHP', name: 'BHP Group', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'AGL', name: 'Anglo American', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'SOL', name: 'Sasol', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'SHP', name: 'Shoprite', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'ABG', name: 'Absa Group', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'SBK', name: 'Standard Bank', provider: 'Individual', category: 'SA Equity' },
  { symbol: 'FSR', name: 'FirstRand', provider: 'Individual', category: 'SA Equity' },
]

/**
 * Search JSE tickers by symbol or name.
 * Case-insensitive search across symbol, name, provider, and category.
 */
export function searchJSETickers(query: string): JSETicker[] {
  if (!query || query.trim().length === 0) {
    return JSE_TICKERS
  }

  const searchTerm = query.toLowerCase().trim()

  return JSE_TICKERS.filter((ticker) => {
    return (
      ticker.symbol.toLowerCase().includes(searchTerm) ||
      ticker.name.toLowerCase().includes(searchTerm) ||
      ticker.provider.toLowerCase().includes(searchTerm) ||
      ticker.category.toLowerCase().includes(searchTerm)
    )
  }).sort((a, b) => {
    // Prioritize exact matches at the start of the symbol
    const aStartsWith = a.symbol.toLowerCase().startsWith(searchTerm)
    const bStartsWith = b.symbol.toLowerCase().startsWith(searchTerm)

    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1

    // Then alphabetically by symbol
    return a.symbol.localeCompare(b.symbol)
  })
}
