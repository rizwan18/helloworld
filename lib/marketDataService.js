// lib/marketDataService.js
//
// Isolates the external market-data provider behind a small, stable interface:
//
//   getLatestPrice(ticker) -> {
//     ticker, price, currency, exchange, timestamp, previousClose,
//     marketState, isStale
//   }
//
// Swap out `fetchFromYahoo` (or add a new provider function and change
// PROVIDER below) without touching api/price.js.
//
// ---------------------------------------------------------------------------
// PROVIDER: Yahoo Finance "chart" endpoint (unofficial, free, no API key)
// ---------------------------------------------------------------------------
// Endpoint:  https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}
// - Free, no signup or API key required.
// - Supports ASX tickers using the ".AX" suffix (e.g. BHP.AX, CBA.AX, CSL.AX)
//   as well as US tickers (AAPL, MSFT) and many other exchanges.
// - Unofficial/undocumented: Yahoo can change or rate-limit it without notice.
// - Must be called server-side: the endpoint does not send CORS headers, so
//   it cannot be called directly from a browser, and calling it from this
//   serverless function also means no credentials are ever exposed client-side.
//
// If you later switch to a paid/registered provider (Alpha Vantage,
// Twelve Data, IEX Cloud, Finnhub, ...) that needs an API key:
//   1. Add the key as a Vercel environment variable (see README) — never
//      hard-code it, and never commit it to this repo.
//   2. Write a new fetchFromX(ticker) function below.
//   3. Point PROVIDER at your new function.
// api/price.js does not need to change.

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const FETCH_TIMEOUT_MS = 8000;

class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ProviderError';
    this.code = code; // 'INVALID_TICKER' | 'NOT_FOUND' | 'UNAVAILABLE' | 'TIMEOUT' | 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'NO_PRICE'
  }
}

/** Basic ticker sanity check: letters, numbers, dot, hyphen, caret only, reasonable length. */
function isPlausibleTicker(ticker) {
  return /^[A-Z0-9][A-Z0-9.\-^]{0,14}$/.test(ticker);
}

function normalizeTicker(raw) {
  return String(raw || '').trim().toUpperCase();
}

async function fetchFromYahoo(ticker) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${YAHOO_CHART_URL}${encodeURIComponent(ticker)}?interval=1d&range=1d`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityPriceLookup/1.0)',
        Accept: 'application/json',
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ProviderError('Market data provider timed out.', 'TIMEOUT');
    }
    throw new ProviderError('Market data provider is unavailable.', 'UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new ProviderError('Market data provider rate limit exceeded.', 'RATE_LIMIT');
  }
  if (response.status === 404) {
    throw new ProviderError('Security not found.', 'NOT_FOUND');
  }
  if (!response.ok) {
    throw new ProviderError(
      `Market data provider returned an unexpected status (${response.status}).`,
      'UNAVAILABLE'
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ProviderError('Market data provider returned an invalid response.', 'INVALID_RESPONSE');
  }

  if (data && data.chart && data.chart.error) {
    // Yahoo returns a chart.error object for unknown tickers instead of HTTP 404.
    throw new ProviderError('Security not found.', 'NOT_FOUND');
  }

  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result || !result.meta) {
    throw new ProviderError('Market data provider returned an invalid response.', 'INVALID_RESPONSE');
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice;

  if (price === undefined || price === null || Number.isNaN(Number(price))) {
    throw new ProviderError('No price is currently available for this security.', 'NO_PRICE');
  }

  const priceTimeSec = meta.regularMarketTime;
  const timestamp = priceTimeSec ? new Date(priceTimeSec * 1000).toISOString() : null;

  const marketState = meta.marketState || null;
  const isStale = marketState ? marketState !== 'REGULAR' : false;

  return {
    ticker: meta.symbol || ticker,
    price: Number(price),
    currency: meta.currency || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    timestamp,
    previousClose: meta.chartPreviousClose !== undefined ? Number(meta.chartPreviousClose) : null,
    marketState,
    isStale,
  };
}

// Active provider — swap this to change data source without touching callers.
const PROVIDER = fetchFromYahoo;

/**
 * Get the latest price for a ticker.
 * @param {string} rawTicker
 * @returns {Promise<object>} normalized price payload
 * @throws {ProviderError}
 */
async function getLatestPrice(rawTicker) {
  const ticker = normalizeTicker(rawTicker);

  if (!ticker) {
    throw new ProviderError('Security code is required.', 'INVALID_TICKER');
  }
  if (!isPlausibleTicker(ticker)) {
    throw new ProviderError('Security code contains invalid characters.', 'INVALID_TICKER');
  }

  return PROVIDER(ticker);
}

module.exports = { getLatestPrice, ProviderError, normalizeTicker, isPlausibleTicker };
