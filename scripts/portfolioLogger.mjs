/**
 * Insider Hub — Portfolio History Logger
 * Snapshots portfolio value for trend charts
 * Runs every 5 min during market hours (on price scrape)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const STOCKS_FILE = './src/content/data/stock-prices.json';
const HISTORY_FILE = './src/content/data/portfolio-history.json';
const DATA_DIR = './src/content/data';

async function loadStocks() {
  if (!existsSync(STOCKS_FILE)) return null;
  try {
    const raw = await readFile(STOCKS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function loadHistory() {
  if (!existsSync(HISTORY_FILE)) {
    return { snapshots: [], metadata: { firstSnapshot: null, lastSnapshot: null, count: 0 } };
  }
  try {
    const raw = await readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { snapshots: [], metadata: { firstSnapshot: null, lastSnapshot: null, count: 0 } };
  }
}

async function saveHistory(history) {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function formatRp(n) {
  if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(2)}B`;
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `Rp ${(n / 1000).toFixed(1)}K`;
  return `Rp ${n.toLocaleString()}`;
}

function isMarketOpen() {
  const now = new Date();
  const wibHour = (now.getUTCHours() + 7) % 24;
  const wibDay = now.getUTCDay();
  
  // Handle UTC day boundary (Sunday = 0, Monday = 1)
  // When UTC is Sunday night, WIB is Monday morning
  let adjustedDay = wibDay;
  if (now.getUTCHours() + 7 >= 24) {
    adjustedDay = (wibDay + 1) % 7;
  }
  
  const isWeekday = adjustedDay >= 1 && adjustedDay <= 5;
  const isMorningSession = wibHour >= 9 && wibHour < 12;
  const isAfternoonSession = wibHour >= 13 && wibHour < 16;
  
  return isWeekday && (isMorningSession || isAfternoonSession);
}

function shouldLog(history) {
  // Only log during market hours
  if (!isMarketOpen()) {
    console.log('Market closed, skipping portfolio snapshot');
    return false;
  }
  
  // If no history, log it
  if (history.snapshots.length === 0) return true;
  
  // Only log if 5+ min since last snapshot (or 30 min if same value)
  const lastSnapshot = history.snapshots[history.snapshots.length - 1];
  const lastTime = new Date(lastSnapshot.timestamp);
  const now = new Date();
  const minutesSince = (now - lastTime) / (1000 * 60);
  
  if (minutesSince < 5) {
    console.log(`Last snapshot ${minutesSince.toFixed(1)} min ago, skipping`);
    return false;
  }
  
  return true;
}

async function logPortfolio() {
  console.log('Logging portfolio snapshot...\n');
  
  const stocks = await loadStocks();
  if (!stocks?.portfolio) {
    console.log('No portfolio data available');
    return false;
  }
  
  const history = await loadHistory();
  
  if (!shouldLog(history)) {
    return false;
  }
  
  const { portfolio } = stocks;
  const now = new Date();
  
  // Create snapshot
  const snapshot = {
    timestamp: now.toISOString(),
    totalEquity: portfolio.totalEquity,
    totalInvested: portfolio.totalInvested,
    totalMarketValue: portfolio.totalMarketValue,
    totalUnrealizedPnl: portfolio.totalUnrealizedPnl,
    totalReturnPct: portfolio.totalReturnPct,
    cash: portfolio.cash,
    positions: {}
  };
  
  // Add individual position P&Ls
  for (const [ticker, data] of Object.entries(stocks.stocks)) {
    if (data.position) {
      snapshot.positions[ticker] = {
        price: data.price,
        marketValue: data.position.marketValue,
        pnl: data.position.totalPnl,
        pnlPct: data.position.pnlPct
      };
    }
  }
  
  // Add to history
  history.snapshots.push(snapshot);
  
  // Prune old data (keep 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const originalCount = history.snapshots.length;
  history.snapshots = history.snapshots.filter(s => new Date(s.timestamp) > ninetyDaysAgo);
  const prunedCount = originalCount - history.snapshots.length;
  
  // Update metadata
  history.metadata = {
    firstSnapshot: history.snapshots[0]?.timestamp || null,
    lastSnapshot: snapshot.timestamp,
    count: history.snapshots.length,
    prunedToday: prunedCount
  };
  
  await saveHistory(history);
  
  console.log('✅ Portfolio snapshot saved');
  console.log(`   Equity: ${formatRp(snapshot.totalEquity)}`);
  console.log(`   P&L: ${formatRp(snapshot.totalUnrealizedPnl)} (${snapshot.totalReturnPct.toFixed(2)}%)`);
  console.log(`   Snapshots: ${history.snapshots.length} total (${prunedCount} old pruned)`);
  
  return true;
}

// Main execution
async function main() {
  try {
    const logged = await logPortfolio();
    process.exit(logged ? 0 : 1); // Exit 0 if logged, 1 if skipped
  } catch (e) {
    console.error('❌ Portfolio logging failed:', e.message);
    process.exit(1);
  }
}

main();
