/**
 * Insider Hub — Commodity Price Scraper
 * Fetches live commodity prices: Coal (Newcastle), Nickel (LME), CPO (Bursa Malaysia), Gold, IDR/USD
 * Updates src/content/data/commodities.json every 30 minutes
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

const DATA_DIR = 'src/content/data';
const OUTPUT_FILE = `${DATA_DIR}/commodities.json`;

// Price fetch sources
const PRICE_SOURCES = {
  // Coal - Newcastle Index (McCloskey/ICE)
  coal: {
    name: 'Coal (Newcastle)',
    unit: 'USD/ton',
    tickers: ['ADRO', 'ITMG', 'PTBA'],
    sources: [
      // Fallback to scraping if API unavailable
      { type: 'rss', url: 'https://www.mining.com/feed/' },
      { type: 'api', url: 'https://api.tradingeconomics.com/markets/commodities?c=coal&client=guest' }
    ]
  },
  
  // Nickel - LME
  nickel: {
    name: 'Nickel (LME)',
    unit: 'USD/tonne',
    tickers: ['ANTM', 'INCO', 'ESSA'],
    sources: [
      { type: 'rss', url: 'https://www.metalbulletin.com/rss' },
      { type: 'api', url: 'https://www.lme.com/api/prices/LME_NI' }
    ]
  },
  
  // CPO - Bursa Malaysia Derivatives
  cpo: {
    name: 'Palm Oil (CPO)',
    unit: 'RM/ton',
    tickers: ['AALI', 'LSIP', 'TAPG', 'PTPS'],
    sources: [
      { type: 'rss', url: 'https://www.bursamalaysia.com/rss' },
      { type: 'scrape', url: 'https://www.bursamalaysia.com/market/derivatives/commodity-products' }
    ]
  },
  
  // Gold - Spot
  gold: {
    name: 'Gold (Spot)',
    unit: 'USD/oz',
    tickers: ['ANTM'],
    sources: [
      { type: 'api', url: 'https://api.gold-api.com/price/XAU-USD' }
    ]
  },
  
  // IDR/USD
  idr_usd: {
    name: 'IDR/USD',
    unit: 'IDR',
    tickers: ['PGEO', 'ESSA', 'All'],
    sources: [
      { type: 'api', url: 'https://api.exchangerate-api.com/v4/latest/USD' }
    ]
  }
};

// Manual price entry fallback (for when APIs fail)
const MANUAL_FALLBACK = {
  coal: { price: 128.50, change: 2.4, changePct: 1.9, source: 'manual' },
  nickel: { price: 16200, change: -80, changePct: -0.5, source: 'manual' },
  cpo: { price: 3850, change: 30, changePct: 0.8, source: 'manual' },
  gold: { price: 2318, change: 14, changePct: 0.6, source: 'manual' },
  idr_usd: { price: 15842, change: -45, changePct: -0.3, source: 'manual' }
};

async function fetchWithTimeout(url, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (InsiderHubBot/1.0)' }
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (e) {
    throw new Error(`Fetch failed: ${e.message}`);
  }
}

async function fetchCoalPrice() {
  try {
    // Try Trading Economics guest API first
    const res = await fetchWithTimeout('https://api.tradingeconomics.com/markets/commodity/coal?client=guest');
    const data = await res.json();
    if (data && data.Price) {
      return {
        price: data.Price,
        change: data.DailyChange || 0,
        changePct: data.DailyChangePercent || 0,
        source: 'tradingeconomics',
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    console.log('Coal API failed, trying RSS fallback...');
  }
  
  // Fallback: Scrape from mining news headlines
  try {
    const rss = await fetchWithTimeout('https://www.mining.com/feed/');
    const text = await rss.text();
    // Extract price mentions from recent headlines
    const priceMatch = text.match(/Newcastle[^$]*\$?([0-9,]+(?:\.[0-9]+)?)/i);
    if (priceMatch) {
      return {
        price: parseFloat(priceMatch[1].replace(',', '')),
        change: 0,
        changePct: 0,
        source: 'mining-news-rss',
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    console.log('Coal RSS failed, using manual fallback');
  }
  
  return { ...MANUAL_FALLBACK.coal, timestamp: new Date().toISOString() };
}

async function fetchNickelPrice() {
  try {
    // LME unofficial API (may be blocked)
    const res = await fetchWithTimeout('https://www.lme.com/api/prices/LME_NI', 5000);
    const data = await res.json();
    return {
      price: data.price || data.lastPrice,
      change: data.change || 0,
      changePct: data.changePercent || 0,
      source: 'lme-api',
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    // Fallback to Trading Economics
    try {
      const res = await fetchWithTimeout('https://api.tradingeconomics.com/markets/commodity/nickel?client=guest');
      const data = await res.json();
      if (data && data.Price) {
        return {
          price: data.Price,
          change: data.DailyChange || 0,
          changePct: data.DailyChangePercent || 0,
          source: 'tradingeconomics',
          timestamp: new Date().toISOString()
        };
      }
    } catch (e2) {
      console.log('Nickel fetch failed, using manual fallback');
    }
  }
  
  return { ...MANUAL_FALLBACK.nickel, timestamp: new Date().toISOString() };
}

async function fetchCPOPrice() {
  try {
    // Bursa Malaysia FCPO (Front Month Futures)
    // Using Trading Economics as proxy
    const res = await fetchWithTimeout('https://api.tradingeconomics.com/markets/commodity/palm%20oil?client=guest');
    const data = await res.json();
    if (data && data.Price) {
      return {
        price: data.Price,
        change: data.DailyChange || 0,
        changePct: data.DailyChangePercent || 0,
        source: 'tradingeconomics',
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    console.log('CPO API failed, using manual fallback');
  }
  
  return { ...MANUAL_FALLBACK.cpo, timestamp: new Date().toISOString() };
}

async function fetchGoldPrice() {
  try {
    const res = await fetchWithTimeout('https://api.gold-api.com/price/XAU-USD');
    const data = await res.json();
    return {
      price: data.price || data.value,
      change: data.change || 0,
      changePct: data.changePercent || 0,
      source: 'gold-api',
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    // Fallback to alternative API
    try {
      const res = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/XAU');
      const data = await res.json();
      if (data && data.rates && data.rates.USD) {
        return {
          price: 1 / data.rates.USD, // XAU per USD → USD per XAU
          change: 0,
          changePct: 0,
          source: 'exchange-rate-api',
          timestamp: new Date().toISOString()
        };
      }
    } catch (e2) {
      console.log('Gold fetch failed, using manual fallback');
    }
  }
  
  return { ...MANUAL_FALLBACK.gold, timestamp: new Date().toISOString() };
}

async function fetchIDRRate() {
  try {
    const res = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    if (data && data.rates && data.rates.IDR) {
      return {
        price: data.rates.IDR,
        change: 0, // API doesn't provide change
        changePct: 0,
        source: 'exchangerate-api',
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    // Fallback to BI middle rate scraping
    try {
      const rss = await fetchWithTimeout('https://www.bi.go.id/en/rss/ExchangeRate.aspx');
      const text = await rss.text();
      const idrMatch = text.match(/IDR[^0-9]*([0-9,]+(?:\.[0-9]+)?)/);
      if (idrMatch) {
        return {
          price: parseFloat(idrMatch[1].replace(',', '')),
          change: 0,
          changePct: 0,
          source: 'bi-rss',
          timestamp: new Date().toISOString()
        };
      }
    } catch (e2) {
      console.log('IDR fetch failed, using manual fallback');
    }
  }
  
  return { ...MANUAL_FALLBACK.idr_usd, timestamp: new Date().toISOString() };
}

async function scrapeAllPrices() {
  console.log('Fetching commodity prices...');
  
  const [coal, nickel, cpo, gold, idr_usd] = await Promise.allSettled([
    fetchCoalPrice(),
    fetchNickelPrice(),
    fetchCPOPrice(),
    fetchGoldPrice(),
    fetchIDRRate()
  ]);
  
  const result = {
    timestamp: new Date().toISOString(),
    commodities: {
      coal: coal.status === 'fulfilled' ? coal.value : { ...MANUAL_FALLBACK.coal, error: coal.reason?.message },
      nickel: nickel.status === 'fulfilled' ? nickel.value : { ...MANUAL_FALLBACK.nickel, error: nickel.reason?.message },
      cpo: cpo.status === 'fulfilled' ? cpo.value : { ...MANUAL_FALLBACK.cpo, error: cpo.reason?.message },
      gold: gold.status === 'fulfilled' ? gold.value : { ...MANUAL_FALLBACK.gold, error: gold.reason?.message },
      idr_usd: idr_usd.status === 'fulfilled' ? idr_usd.value : { ...MANUAL_FALLBACK.idr_usd, error: idr_usd.reason?.message }
    },
    meta: {
      nextUpdate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      dataSource: 'mixed-api-rss-manual'
    }
  };
  
  return result;
}

async function savePrices(data) {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  
  await writeFile(OUTPUT_FILE, JSON.stringify(data, null, 2));
  console.log(`Prices saved to ${OUTPUT_FILE}`);
  console.log('Commodities updated:', Object.keys(data.commodities).join(', '));
}

// Main execution
async function main() {
  try {
    const prices = await scrapeAllPrices();
    await savePrices(prices);
    console.log('✅ Commodity price scrape complete');
    process.exit(0);
  } catch (e) {
    console.error('❌ Scrape failed:', e.message);
    process.exit(1);
  }
}

main();
