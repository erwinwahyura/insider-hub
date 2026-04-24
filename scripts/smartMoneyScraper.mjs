#!/usr/bin/env node
/**
 * Smart Money Tracker — Institutional Accumulation Patterns
 * Detects accumulation, distribution, and unusual volume patterns
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../src/content/data');
const OUTPUT_FILE = join(DATA_DIR, 'smart-money.json');
const STOCK_PRICES_FILE = join(DATA_DIR, 'stock-prices.json');

// Ensure data directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

const PORTFOLIO_TICKERS = ['PTPS', 'PGEO', 'ESSA', 'ITMG', 'ADRO', 'AALI', 'LSIP', 'ANTM', 'INCO', 'BBRI', 'BBCA', 'TLKM'];

// Volume averages (20-day typical)
const VOLUME_AVG = {
  'PTPS': 5000000,
  'PGEO': 15000000,
  'ESSA': 200000000,
  'ITMG': 1000000,
  'ADRO': 40000000,
  'AALI': 2000000,
  'LSIP': 8000000,
  'ANTM': 30000000,
  'INCO': 8000000,
  'BBRI': 200000000,
  'BBCA': 200000000,
  'TLKM': 100000000
};

function detectPattern(ticker, priceData, volume) {
  const avgVolume = VOLUME_AVG[ticker] || volume;
  const volumeRatio = volume / avgVolume;
  const changePct = priceData?.changePct || 0;
  
  // Pattern detection logic
  let pattern = 'NEUTRAL';
  let confidence = 'LOW';
  let signal = null;
  
  // Accumulation: High volume + price up or flat
  if (volumeRatio > 2.0 && changePct > -1) {
    pattern = changePct > 2 ? 'STRONG_ACCUMULATION' : 'ACCUMULATION';
    confidence = volumeRatio > 4 ? 'HIGH' : 'MEDIUM';
    signal = 'BULLISH';
  }
  // Distribution: High volume + price down
  else if (volumeRatio > 2.0 && changePct < -1) {
    pattern = changePct < -3 ? 'STRONG_DISTRIBUTION' : 'DISTRIBUTION';
    confidence = volumeRatio > 4 ? 'HIGH' : 'MEDIUM';
    signal = 'BEARISH';
  }
  // Quiet accumulation: Moderate volume + steady climb
  else if (volumeRatio > 1.3 && changePct > 0.5 && changePct < 3) {
    pattern = 'QUIET_ACCUMULATION';
    confidence = 'MEDIUM';
    signal = 'BULLISH';
  }
  // Volume spike anomaly
  else if (volumeRatio > 3.0) {
    pattern = 'VOLUME_SPIKE';
    confidence = 'HIGH';
    signal = changePct > 0 ? 'BULLISH' : 'BEARISH';
  }
  
  return {
    pattern,
    confidence,
    signal,
    volumeRatio: parseFloat(volumeRatio.toFixed(2)),
    avgVolume,
    interpretation: getInterpretation(pattern, ticker)
  };
}

function getInterpretation(pattern, ticker) {
  const interpretations = {
    'STRONG_ACCUMULATION': 'Institutional buying detected — large blocks being absorbed',
    'ACCUMULATION': 'Smart money accumulating — watch for breakout',
    'QUIET_ACCUMULATION': 'Steady institutional buying under the radar',
    'STRONG_DISTRIBUTION': 'Heavy institutional selling — caution advised',
    'DISTRIBUTION': 'Distribution pattern — reduce exposure',
    'VOLUME_SPIKE': 'Unusual activity — investigate catalyst',
    'NEUTRAL': 'No clear institutional signal'
  };
  
  return interpretations[pattern] || 'Monitor for developments';
}

async function fetchSmartMoneyData() {
  const now = new Date();
  
  // Load current price data
  let priceData = {};
  try {
    if (existsSync(STOCK_PRICES_FILE)) {
      const prices = JSON.parse(readFileSync(STOCK_PRICES_FILE, 'utf8'));
      priceData = prices.stocks || {};
    }
  } catch (e) {
    console.warn('Could not load price data');
  }
  
  const smartMoneyData = {
    timestamp: now.toISOString(),
    date: now.toISOString().split('T')[0],
    summary: {
      accumulationCount: 0,
      distributionCount: 0,
      neutralCount: 0,
      topSignals: []
    },
    tickers: {}
  };
  
  const signals = [];
  
  for (const ticker of PORTFOLIO_TICKERS) {
    const stockInfo = priceData[ticker] || {};
    const volume = stockInfo.volume || VOLUME_AVG[ticker] || 0;
    
    const analysis = detectPattern(ticker, stockInfo, volume);
    
    smartMoneyData.tickers[ticker] = {
      name: stockInfo.name || ticker,
      price: stockInfo.price || 0,
      changePct: stockInfo.changePct || 0,
      volume,
      ...analysis
    };
    
    // Count patterns
    if (analysis.signal === 'BULLISH') smartMoneyData.summary.accumulationCount++;
    else if (analysis.signal === 'BEARISH') smartMoneyData.summary.distributionCount++;
    else smartMoneyData.summary.neutralCount++;
    
    // Collect high-confidence signals
    if (analysis.confidence === 'HIGH') {
      signals.push({
        ticker,
        pattern: analysis.pattern,
        signal: analysis.signal,
        confidence: analysis.confidence
      });
    }
  }
  
  // Sort signals by significance
  signals.sort((a, b) => {
    const score = { 'STRONG_ACCUMULATION': 4, 'STRONG_DISTRIBUTION': 3, 'ACCUMULATION': 2, 'DISTRIBUTION': 1 };
    return (score[b.pattern] || 0) - (score[a.pattern] || 0);
  });
  
  smartMoneyData.summary.topSignals = signals.slice(0, 5);
  
  return smartMoneyData;
}

async function main() {
  console.log('Analyzing smart money patterns...');
  
  try {
    const data = await fetchSmartMoneyData();
    
    writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    
    console.log('✅ Smart money analysis complete');
    console.log(`   Accumulation: ${data.summary.accumulationCount} | Distribution: ${data.summary.distributionCount} | Neutral: ${data.summary.neutralCount}`);
    
    if (data.summary.topSignals.length > 0) {
      console.log('   HIGH CONFIDENCE SIGNALS:');
      data.summary.topSignals.forEach(s => {
        console.log(`     ${s.ticker}: ${s.pattern} (${s.signal})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Smart money analysis failed:', error.message);
    process.exit(1);
  }
}

main();
