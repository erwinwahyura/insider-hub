/**
 * Insider Hub — Discord Price Alerts
 * Sends Discord DM when price thresholds hit
 * Triggered by alertChecker when conditions met
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const ALERTS_FILE = './src/content/data/alerts.json';
const STOCKS_FILE = './src/content/data/stock-prices.json';

// Load alert and stock data
async function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatRp(n) {
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `Rp ${(n / 1000).toFixed(1)}K`;
  return `Rp ${n.toLocaleString()}`;
}

async function generateAlertMessages() {
  const alertsData = await loadJson(ALERTS_FILE);
  const stockData = await loadJson(STOCKS_FILE);
  
  if (!alertsData || !stockData) return [];
  
  const messages = [];
  
  // Check each alert
  for (const alert of alertsData.alerts) {
    if (!alert.enabled) continue;
    
    const stock = stockData.stocks?.[alert.ticker];
    if (!stock?.position) continue;
    
    const currentPrice = stock.price;
    const { position } = stock;
    
    // PTPS buy opportunity @ 175
    if (alert.id === 'ptps-buy-opportunity' && currentPrice <= alert.target) {
      messages.push({
        priority: 'high',
        emoji: '🟢',
        ticker: 'PTPS',
        title: 'PTPS Buy Opportunity Triggered',
        message: `Price dropped to ${currentPrice} (target: ${alert.target})\nYour position: ${position.lots} lots @ avg ${position.avgPrice}\nCurrent P&L: ${formatRp(position.totalPnl)} (${position.pnlPct.toFixed(2)}%)\n\nConsider adding to position for B50/PKS thesis.`,
        action: 'Review position sizing'
      });
    }
    
    // PTPS stop loss @ 150
    if (alert.id === 'ptps-stop-loss' && currentPrice <= alert.target) {
      messages.push({
        priority: 'critical',
        emoji: '🔴',
        ticker: 'PTPS',
        title: 'PTPS Stop Loss Zone',
        message: `FELL TO ${currentPrice} (below ${alert.target})\nYour position: ${position.lots} lots @ avg ${position.avgPrice}\nCurrent P&L: ${formatRp(position.totalPnl)} (${position.pnlPct.toFixed(2)}%)\n\nReview thesis — potential stop loss or thesis break.`,
        action: 'URGENT: Reassess CALK 15(c) thesis'
      });
    }
    
    // PGEO breakout @ 1100
    if (alert.id === 'pgeo-breakout' && currentPrice >= alert.target) {
      messages.push({
        priority: 'medium',
        emoji: '📈',
        ticker: 'PGEO',
        title: 'PGEO Breakout!',
        message: `Price broke ${alert.target} at ${currentPrice}\nYour position: ${position.lots} lots @ avg ${position.avgPrice}\nCurrent P&L: ${formatRp(position.totalPnl)} (+${position.pnlPct.toFixed(2)}%)\n\nMomentum building toward analyst target 1,662.`,
        action: 'Consider trailing stop'
      });
    }
    
    // ESSA recovery @ 750
    if (alert.id === 'essa-recovery' && currentPrice >= alert.target) {
      messages.push({
        priority: 'medium',
        emoji: '📈',
        ticker: 'ESSA',
        title: 'ESSA Recovery',
        message: `Back to ${currentPrice} (above ${alert.target})\nYour position: ${position.lots} lots @ avg ${position.avgPrice}\nCurrent P&L: ${formatRp(position.totalPnl)} (+${position.pnlPct.toFixed(2)}%)\n\nQ1 2026 catalyst approaching.`,
        action: 'Hold for Q1 catalyst'
      });
    }
    
    // P&L change alerts
    if (Math.abs(position.totalPnl) > 2000000) { // Rp 2jt threshold
      const isGain = position.totalPnl > 0;
      messages.push({
        priority: isGain ? 'medium' : 'high',
        emoji: isGain ? '💰' : '⚠️',
        ticker: alert.ticker,
        title: `${alert.ticker} Large P&L Move`,
        message: `Unrealized P&L: ${formatRp(position.totalPnl)} (${position.pnlPct.toFixed(2)}%)`,
        action: isGain ? 'Consider partial profit' : 'Review stop loss'
      });
    }
  }
  
  // Portfolio summary alert
  const portfolio = stockData.portfolio;
  if (portfolio && Math.abs(portfolio.totalUnrealizedPnl) > 3000000) {
    messages.push({
      priority: 'medium',
      emoji: '📊',
      ticker: 'PORTFOLIO',
      title: 'Portfolio P&L Alert',
      message: `Total P&L: ${formatRp(portfolio.totalUnrealizedPnl)} (${portfolio.totalReturnPct.toFixed(2)}%)\nEquity: ${formatRp(portfolio.totalEquity)}`,
      action: 'Review allocation'
    });
  }
  
  return messages;
}

// Generate alert output for Discord
async function main() {
  const messages = await generateAlertMessages();
  
  if (messages.length === 0) {
    console.log('No active price alerts to send');
    process.exit(0);
  }
  
  // Output formatted for Discord
  for (const msg of messages) {
    console.log(`\n${msg.emoji} **${msg.title}**`);
    console.log(`\`${msg.ticker}\` | ${msg.priority.toUpperCase()}`);
    console.log(msg.message);
    if (msg.action) {
      console.log(`> Action: ${msg.action}`);
    }
    console.log('---');
  }
  
  // Return count for heartbeat processing
  console.log(`\n🔔 ${messages.length} alert(s) ready to send`);
  process.exit(0);
}

main().catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
