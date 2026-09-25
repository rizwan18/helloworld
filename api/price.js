// Vercel serverless function: latest security price lookup.
// Frontend -> this function -> lib/marketDataService.js -> external provider.
// Provider call stays server-side only; no credentials are ever sent to the browser.
const { getLatestPrice, ProviderError } = require('../lib/marketDataService');

// Soft in-memory cache to reduce duplicate calls to the free provider and
// help with its rate limits. Only helps within a single warm lambda instance
// (serverless instances are ephemeral/parallel, so this is a best-effort
// optimisation, not a guarantee) — good enough for a small utility.
const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // ticker -> { data, expiresAt }

function getCached(ticker) {
  const entry = cache.get(ticker);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) cache.delete(ticker);
  return null;
}

function setCached(ticker, data) {
  cache.set(ticker, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Map internal provider error codes -> { status, message } shown to the client.
const ERROR_MAP = {
  INVALID_TICKER: { status: 400, message: 'Please enter a valid security code.' },
  NOT_FOUND: { status: 404, message: 'Security not found. Please check the code and try again.' },
  NO_PRICE: { status: 502, message: 'No price is currently available for this security.' },
  RATE_LIMIT: { status: 429, message: 'Too many requests right now. Please try again shortly.' },
  TIMEOUT: { status: 504, message: 'The market data provider took too long to respond. Please try again.' },
  UNAVAILABLE: { status: 502, message: 'The market data provider is currently unavailable. Please try again shortly.' },
  INVALID_RESPONSE: { status: 502, message: 'Received an unexpected response from the market data provider.' },
};

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const rawTicker = req.query && req.query.ticker;
  if (!rawTicker || !String(rawTicker).trim()) {
    return res.status(400).json({ error: 'A security code is required.' });
  }

  const ticker = String(rawTicker).trim().toUpperCase();

  const cached = getCached(ticker);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  try {
    const result = await getLatestPrice(ticker);
    const payload = {
      ticker: result.ticker,
      price: result.price,
      currency: result.currency,
      exchange: result.exchange,
      timestamp: result.timestamp,
      previousClose: result.previousClose,
      isStale: result.isStale,
      marketState: result.marketState,
    };
    setCached(ticker, payload);
    return res.status(200).json(payload);
  } catch (err) {
    if (err instanceof ProviderError) {
      const mapped = ERROR_MAP[err.code] || { status: 502, message: 'Unable to retrieve the latest price.' };
      console.error(`[price] ${ticker}: ${err.code} - ${err.message}`);
      return res.status(mapped.status).json({ error: mapped.message });
    }
    console.error(`[price] ${ticker}: unexpected error`, err);
    return res.status(500).json({ error: 'Something went wrong while retrieving the price. Please try again.' });
  }
};
