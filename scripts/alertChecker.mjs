/**
 * Insider Hub — Alert Checker
 * Checks price alerts against live stock/commodity data
 * Sends notifications via web push, Telegram, or console
 */

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const ALERTS_FILE = './src/content/data/alerts.json';
const STOCKS_FILE = './src/content/data/stock-prices.json';
const COMMODITIES_FILE = './src/content/data/commodities.json';

async function loadAlerts() {
  if (!existsSync(ALERTS_FILE)) {
    console.log('No alerts file found, skipping alert check');
    return null;
  }
  try {
    const raw = await readFile(ALERTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load alerts:', e.message);
    return null;
  }
}

async function loadStockPrices() {
  if (!existsSync(STOCKS_FILE)) {
    return null;
  }
  try {
    const raw = await readFile(STOCKS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function loadCommodities() {
  if (!existsSync(COMMODITIES_FILE)) {
    return null;
  }
  try {
    const raw = await readFile(COMMODITIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function formatCurrency(n) {
  if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)}B`;
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `Rp ${(n / 1000).toFixed(1)}K`;
  return `Rp ${n.toLocaleString()}`;
}

function shouldTriggerAlert(alert, currentPrice) {
  if (!alert.enabled || alert.triggered) return false;
  
  const now = new Date();
  const lastTriggered = alert.lastTriggered ? new Date(alert.lastTriggered) : null;
  
  // Check cooldown
  if (lastTriggered) {
    const minutesSince = (now - lastTriggered) / (1000 * 60);
    if (minutesSince < alert.cooldownMinutes) return false;
  }
  
  // Check price condition
  if (alert.type === 'price_below') {
    return currentPrice <= alert.target;
  } else if (alert.type === 'price_above') {
    return currentPrice >= alert.target;
  } else if (alert.type === 'commodity_below') {
    return currentPrice <= alert.target;
  } else if (alert.type === 'commodity_above') {
    return currentPrice >= alert.target;
  } else if (alert.type === 'pnl_threshold') {
    return Math.abs(currentPrice) >= alert.target; // currentPrice is P&L value
  }
  
  return false;
}

function formatMessage(template, data) {
  return template
    .replace('{price}', data.price)
    .replace('{target}', data.target)
    .replace('{ticker}', data.ticker)
    .replace('{change}', data.change || '');
}

async function sendNotification(alert, data) {
  const message = formatMessage(alert.message, data);
  
  // Console notification (always works)
  console.log(`\n🔔 ALERT: ${message}\n`);
  
  // Web Push (requires subscription - placeholder for now)
  // This would integrate with a push service like OneSignal or custom push
  
  // Telegram (if configured)
  // Would need TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars
  
  return message;
}

async function checkAlerts() {
  console.log('Checking price alerts...\n');
  
  const alertsData = await loadAlerts();
  if (!alertsData || !alertsData.enabled) {
    console.log('Alerts disabled or no config');
    return;
  }
  
  const stockData = await loadStockPrices();
  const commodityData = await loadCommodities();
  
  let triggeredCount = 0;
  const updatedAlerts = [];
  const notifications = [];
  
  for (const alert of alertsData.alerts) {
    let currentPrice = null;
    let data = null;
    
    // Get current price based on alert type
    if (alert.type.startsWith('price_')) {
      data = stockData?.stocks?.[alert.ticker];
      currentPrice = data?.price;
    } else if (alert.type.startsWith('commodity_')) {
      const key = alert.ticker.toLowerCase();
      data = commodityData?.commodities?.[key];
      currentPrice = data?.price;
    }
    
    if (currentPrice === null || currentPrice === undefined) {
      console.log(`⚠️  No price data for ${alert.ticker}, skipping`);
      updatedAlerts.push(alert);
      continue;
    }
    
    // Update alert with current price
    alert.current = currentPrice;
    
    // Check if should trigger
    if (shouldTriggerAlert(alert, currentPrice)) {
      const notificationData = {
        ticker: alert.ticker,
        price: alert.unit ? `${currentPrice} ${alert.unit}` : currentPrice.toLocaleString(),
        target: alert.target.toLocaleString(),
        change: data?.changePct ? `${data.changePct > 0 ? '+' : ''}${data.changePct.toFixed(2)}%` : null
      };
      
      const message = await sendNotification(alert, notificationData);
      notifications.push({
        id: alert.id,
        ticker: alert.ticker,
        message,
        priority: alert.priority,
        timestamp: new Date().toISOString()
      });
      
      // Mark as triggered with cooldown
      alert.triggered = true;
      alert.lastTriggered = new Date().toISOString();
      triggeredCount++;
      
      console.log(`✅ Alert triggered: ${alert.id}`);
    } else {
      // Reset triggered status if price moved away from target (with hysteresis)
      if (alert.triggered) {
        const hysteresis = alert.target * 0.02; // 2% hysteresis
        if (alert.type === 'price_below' && currentPrice > alert.target + hysteresis) {
          alert.triggered = false;
          console.log(`🔄 Reset alert: ${alert.id} (price recovered)`);
        } else if (alert.type === 'price_above' && currentPrice < alert.target - hysteresis) {
          alert.triggered = false;
          console.log(`🔄 Reset alert: ${alert.id} (price dropped back)`);
        }
      }
    }
    
    updatedAlerts.push(alert);
  }
  
  // Update alerts file
  alertsData.alerts = updatedAlerts;
  alertsData.lastUpdated = new Date().toISOString();
  alertsData.portfolioSummary.alertsToday = triggeredCount;
  
  await writeFile(ALERTS_FILE, JSON.stringify(alertsData, null, 2));
  
  console.log(`\n📊 Alert Check Complete:`);
  console.log(`   - Alerts checked: ${alertsData.alerts.length}`);
  console.log(`   - Triggered: ${triggeredCount}`);
  console.log(`   - Notifications sent: ${notifications.length}`);
  
  return {
    checked: alertsData.alerts.length,
    triggered: triggeredCount,
    notifications
  };
}

// Portfolio P&L alerts
async function checkPortfolioAlerts() {
  const stockData = await loadStockPrices();
  if (!stockData?.portfolio) return;
  
  const { totalUnrealizedPnl, totalReturnPct } = stockData.portfolio;
  
  // Daily P&L threshold alerts
  if (Math.abs(totalReturnPct) > 5) {
    console.log(`\n⚠️  PORTFOLIO ALERT: Daily P&L ${totalReturnPct > 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`);
    console.log(`   Unrealized P&L: ${formatCurrency(totalUnrealizedPnl)}\n`);
  }
}

// Main execution
async function main() {
  try {
    await checkAlerts();
    await checkPortfolioAlerts();
    process.exit(0);
  } catch (e) {
    console.error('❌ Alert check failed:', e.message);
    process.exit(1);
  }
}

main();
