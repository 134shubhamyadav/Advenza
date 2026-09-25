import { logger } from "../../utils/logger.js";

// Dependable offline baseline exchange rates (relative to INR)
const BASELINE_RATES_TO_INR = {
  INR: 1.0,
  USD: 84.2,
  EUR: 92.5,
  GBP: 108.5,
  AED: 22.9,
  JPY: 0.56,
  THB: 2.45,
  SGD: 63.8,
  CAD: 61.8,
  AUD: 56.2,
  CHF: 96.0,
};

class CurrencyService {
  constructor() {
    this.cachedRates = { ...BASELINE_RATES_TO_INR };
    this.lastFetched = 0;
    this.TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
  }

  /**
   * Refreshes live FX rates from a public exchange API or keeps resilient baseline rates.
   */
  async refreshRates() {
    if (Date.now() - this.lastFetched < this.TTL_MS) {
      return this.cachedRates;
    }

    try {
      const res = await fetch("https://open.er-api.com/v6/latest/INR", {
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          // Convert rates to "1 UNIT = X INR"
          const updated = { INR: 1.0 };
          for (const [curr, rateAgainstInr] of Object.entries(data.rates)) {
            if (rateAgainstInr > 0) {
              updated[curr.toUpperCase()] = Number((1 / rateAgainstInr).toFixed(4));
            }
          }
          this.cachedRates = { ...this.cachedRates, ...updated };
          this.lastFetched = Date.now();
          logger.info("[CurrencyService] Successfully refreshed live exchange rates against INR.");
        }
      }
    } catch (err) {
      logger.debug(`[CurrencyService] FX rates refresh fallback to baseline: ${err.message}`);
    }

    return this.cachedRates;
  }

  /**
   * Converts an amount from one currency to another.
   * Preserves exact original numbers and includes the timestamped exchange rate.
   */
  async convert({ amount, fromCurrency = "INR", toCurrency = "INR" }) {
    const amt = Number(amount) || 0;
    const from = (fromCurrency || "INR").trim().toUpperCase();
    const to = (toCurrency || "INR").trim().toUpperCase();

    if (from === to || amt === 0) {
      return {
        originalAmount: amt,
        originalCurrency: from,
        convertedAmount: amt,
        tripCurrency: to,
        exchangeRate: 1.0,
        rateTimestamp: new Date(),
      };
    }

    await this.refreshRates();

    const fromRateToInr = this.cachedRates[from] || BASELINE_RATES_TO_INR[from] || 1.0;
    const toRateToInr = this.cachedRates[to] || BASELINE_RATES_TO_INR[to] || 1.0;

    // Cross rate: 1 FROM = (fromRateToInr / toRateToInr) TO
    const exchangeRate = Number((fromRateToInr / toRateToInr).toFixed(6));
    const convertedAmount = Math.round(amt * exchangeRate * 100) / 100;

    return {
      originalAmount: amt,
      originalCurrency: from,
      convertedAmount,
      tripCurrency: to,
      exchangeRate,
      rateTimestamp: new Date(),
    };
  }

  /**
   * Synchronous conversion using latest cached rates.
   */
  convertSync({ amount, fromCurrency = "INR", toCurrency = "INR" }) {
    const amt = Number(amount) || 0;
    const from = (fromCurrency || "INR").trim().toUpperCase();
    const to = (toCurrency || "INR").trim().toUpperCase();

    if (from === to || amt === 0) {
      return {
        originalAmount: amt,
        originalCurrency: from,
        convertedAmount: amt,
        tripCurrency: to,
        exchangeRate: 1.0,
        rateTimestamp: new Date(),
      };
    }

    const fromRateToInr = this.cachedRates[from] || BASELINE_RATES_TO_INR[from] || 1.0;
    const toRateToInr = this.cachedRates[to] || BASELINE_RATES_TO_INR[to] || 1.0;

    const exchangeRate = Number((fromRateToInr / toRateToInr).toFixed(6));
    const convertedAmount = Math.round(amt * exchangeRate * 100) / 100;

    return {
      originalAmount: amt,
      originalCurrency: from,
      convertedAmount,
      tripCurrency: to,
      exchangeRate,
      rateTimestamp: new Date(),
    };
  }
}

export const currencyService = new CurrencyService();
export default currencyService;
