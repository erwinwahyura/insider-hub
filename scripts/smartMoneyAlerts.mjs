#!/usr/bin/env node
/**
 * Smart Money Discord Alerts
 * Sends notifications for accumulation/distribution patterns and block trades
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../src/content/data');
const SMART_MONEY_FILE = join(DATA_DIR, 'smart-money.json');
const FOREIGN_FLOW_FILE = join(DATA_DIR, 'foreign-flow.json');
const BLOCK_TRADES_FILE = join(DATA_DIR, 'block-trades.json');
const STOCK_PRICES_FILE = join(DATA_DIR, 'stock-prices.json');
const ALERT_STATE_FILE = join(DATA_DIR, '.alert-state-smartmoney.json');

// Alert thresholds
const ALERT_CONFIG = {
  // Smart money pattern alerts
  accumulationThreshold: 'HIGH', // Alert on HIGH confidence accumulation
  distributionThreshold: 'HIGH', // Alert on HIGH confidence distribution
  
  // Foreign flow alerts
  foreignBuyThreshold: 5000000000,  // Rp 5B+ foreign buying
  foreignSellThreshold: -5000000000, // Rp 5B+ foreign selling
  
  // Block trade alerts
  blockTradeThreshold: 10000000000, // Rp 10B+ block trades
  
  // Portfolio-specific alerts (your positions)
  portfolioTickers: ['PTPS', 'PGEO', 'ESSA', 'ITMG'],
  
  // Cooldown periods (minutes)
  patternCooldown: 240,      // 4 hours between same pattern alerts
  foreignFlowCooldown: 120,  // 2 hours between foreign flow alerts
  blockTradeCooldown: 60     // 1 hour between block trade alerts
};

function formatRp(n) {
  if (!n) return 'Rp 0';
  if (Math.abs(n) >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)}B`;
  if (Math.abs(n) >= 1000000) return `Rp ${(n / 1000000).toFixed(1)}M`;
  return `Rp ${Math.abs(n).toLocaleString()}`;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return null;
  }
}

function loadAlertState() {
  if (!existsSync(ALERT_STATE_FILE)) {
    return {
      lastPatternAlerts: {},
      lastForeignFlowAlerts: {},
      lastBlockTradeAlerts: {},
      alertedTrades: []
    };
  }
  return loadJson(ALERT_STATE_FILE);
}

function saveAlertState(state) {
  const fs = await import('fs');
  fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
}

function isCooldownExpired(lastAlertTime, cooldownMinutes) {
  if (!lastAlertTime) return true;
  const last = new Date(lastAlertTime).getTime();
  const now = Date.now();
  const cooldownMs = cooldownMinutes * 60 * 1000;
  return (now - last) > cooldownMs;
}

function generateSmartMoneyAlerts(smartMoney, foreignFlow, blockTrades, stockPrices, alertState) {
  const alerts = [];
  const now = new Date().toISOString();
  
  // 1. Pattern Alerts (Accumulation/Distribution)
  if (smartMoney?.summary?.topSignals) {
    for (const signal of smartMoney.summary.topSignals) {
      const { ticker, pattern, signal: direction, confidence } = signal;
      
      // Only alert on HIGH confidence for portfolio tickers
      if (confidence !== 'HIGH') continue;
      if (!ALERT_CONFIG.portfolioTickers.includes(ticker)) continue;
      
      const alertKey = `${ticker}-${pattern}`;
      const lastAlert = alertState.lastPatternAlerts[alertKey];
      
      if (isCooldownExpired(lastAlert, ALERT_CONFIG.patternCooldown)) {
        const stock = stockPrices?.stocks?.[ticker];
        const emoji = direction === 'BULLISH' ? '🟢' : '🔴';
        const title = direction === 'BULLISH' ? 'ACCUMULATION DETECTED' : 'DISTRIBUTION ALERT';
        
        alerts.push({
          type: 'pattern',
          priority: direction === 'BULLISH' ? 'medium' : 'high',
          emoji,
          ticker,
          title: `${ticker} ${title}`,
          message: `**Pattern:** ${pattern.replace(/_/g, ' ')}\n**Confidence:** ${confidence}\n**Current Price:** ${stock?.price || 'N/A'} (${stock?.changePct > 0 ? '+' : ''}${stock?.changePct?.toFixed(2) || 0}%)\n**Volume Ratio:** ${smartMoney.tickers?.[ticker]?.volumeRatio?.toFixed(2) || 'N/A'}x avg`,
          action: direction === 'BULLISH' ? 'Consider adding on dips' : 'Review stop loss levels',
          alertKey,
          timestamp: now
        });
        
        alertState.lastPatternAlerts[alertKey] = now;
      }
    }
  }
  
  // 2. Foreign Flow Alerts (Portfolio-specific)
  if (foreignFlow?.tickers) {
    for (const ticker of ALERT_CONFIG.portfolioTickers) {
      const flow = foreignFlow.tickers[ticker];
      if (!flow) continue;
      
      const alertKey = `${ticker}-foreign`;
      const lastAlert = alertState.lastForeignFlowAlerts[alertKey];
      
      // Alert on significant foreign flow
      if (Math.abs(flow.netFlow) >= ALERT_CONFIG.foreignBuyThreshold) {
        if (isCooldownExpired(lastAlert, ALERT_CONFIG.foreignFlowCooldown)) {
          const isBuy = flow.netFlow > 0;
          const emoji = isBuy ? '🌏🟢' : '🌏🔴';
          const title = isBuy ? 'FOREIGN BUYING' : 'FOREIGN SELLING';
          
          alerts.push({
            type: 'foreign',
            priority: isBuy ? 'medium' : 'high',
            emoji,
            ticker,
            title: `${ticker} ${title}`,
            message: `**Net Flow:** ${formatRp(flow.netFlow)}\n**Buy:** ${formatRp(flow.buyValue)} | **Sell:** ${formatRp(flow.sellValue)}\n**Trend:** ${flow.trend}\n**Intensity:** ${flow.intensity.toUpperCase()}`,
            action: isBuy ? 'Foreign accumulating — follow smart money' : 'Foreign exiting — monitor closely',
            alertKey,
            timestamp: now
          });
          
          alertState.lastForeignFlowAlerts[alertKey] = now;
        }
      }
    }
  }
  
  // 3. Block Trade Alerts
  if (blockTrades?.trades) {
    for (const trade of blockTrades.trades) {
      // Skip if already alerted on this trade
      if (alertState.alertedTrades.includes(trade.id)) continue;
      
      // Only alert on significant block trades for portfolio tickers
      if (!ALERT_CONFIG.portfolioTickers.includes(trade.ticker)) continue;
      if (trade.value < ALERT_CONFIG.blockTradeThreshold) continue;
      
      const alertKey = `${trade.ticker}-block`;
      const lastAlert = alertState.lastBlockTradeAlerts[alertKey];
      
      if (isCooldownExpired(lastAlert, ALERT_CONFIG.blockTradeCooldown)) {
        const emoji = trade.type === 'BUY' ? '💼🟢' : '💼🔴';
        
        alerts.push({
          type: 'block',
          priority: trade.value > 20000000000 ? 'high' : 'medium', // Rp 20B+ = high priority
          emoji,
          ticker: trade.ticker,
          title: `${trade.ticker} BLOCK TRADE: ${trade.type}`,
          message: `**Value:** ${formatRp(trade.value)}\n**Volume:** ${(trade.volume / 1000000).toFixed(1)}M shares @ ${trade.price}\n**Party:** ${trade.party}\n**Significance:** ${trade.significance}`,
          action: trade.notes,
          alertKey,
          tradeId: trade.id,
          timestamp: now
        });
        
        alertState.lastBlockTradeAlerts[alertKey] = now;
        alertState.alertedTrades.push(trade.id);
        
        // Keep last 100 alerted trades
        if (alertState.alertedTrades.length > 100) {
          alertState.alertedTrades = alertState.alertedTrades.slice(-100);
        }
      }
    }
  }
  
  return { alerts, alertState };
}

async function main() {
  console.log('Checking smart money alerts...\n');
  
  // Load data
  const smartMoney = loadJson(SMART_MONEY_FILE);
  const foreignFlow = loadJson(FOREIGN_FLOW_FILE);
  const blockTrades = loadJson(BLOCK_TRADES_FILE);
  const stockPrices = loadJson(STOCK_PRICES_FILE);
  let alertState = loadAlertState();
  
  if (!smartMoney && !foreignFlow && !blockTrades) {
    console.log('No smart money data available');
    process.exit(0);
  }
  
  // Generate alerts
  const { alerts, alertState: newState } = generateSmartMoneyAlerts(
    smartMoney, foreignFlow, blockTrades, stockPrices, alertState
  );
  
  // Save updated state
  const fs = await import('fs');
  fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(newState, null, 2));
  
  if (alerts.length === 0) {
    console.log('✅ No new smart money alerts (all in cooldown or no significant activity)');
    process.exit(0);
  }
  
  // Output alerts for Discord
  console.log(`🔔 ${alerts.length} SMART MONEY ALERT(S)\n`);
  console.log('='.repeat(50));
  
  for (const alert of alerts) {
    console.log(`\n${alert.emoji} **${alert.title}**`);
    console.log(`\`${alert.ticker}\` | ${alert.type.toUpperCase()} | ${alert.priority.toUpperCase()}`);
    console.log(alert.message);
    console.log(`> 💡 ${alert.action}`);
    console.log('─'.repeat(40));
  }
  
  console.log(`\n✅ Alert state updated (${newState.alertedTrades.length} trades tracked)`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Smart money alert check failed:', e.message);
  process.exit(1);
});
