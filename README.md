# Insider Hub — Indonesia Market Intelligence

Real-time portfolio tracking, news aggregation, and market intelligence for IDX (Indonesian Stock Exchange) investors.

**Live:** [stocks.erwarx.com](https://stocks.erwarx.com)

---

## ✅ Current Features

### 📊 Live Portfolio Dashboard
- **Real-time P&L tracking** — PTPS, PGEO, ESSA, ITMG, ADRO positions
- **Live stock prices** via Yahoo Finance (updated every 5 min during market hours)
- **Unrealized gains/losses** with Rupiah formatting
- **Position sizing** — lots, average price, current market value

### 📈 Market Data
- **12 IDX stocks tracked** — PTPS, PGEO, ESSA, ITMG, ADRO, AALI, LSIP, ANTM, INCO, BBRI, BBCA, TLKM
- **Commodity prices** — Coal (Newcastle), Nickel (LME), CPO, Gold, IDR/USD
- **Auto-refresh** — 5 min during IDX hours (09:00-12:00, 13:30-16:00 WIB), 30 min when closed

### 📰 News Aggregation
- **Automated scraping** — Google News RSS, IDX sources
- **AI summarization** — Elesis bot processes articles with portfolio impact analysis
- **Ticker tagging** — auto-detects PTPS, ADRO, coal, nickel mentions
- **Sentiment scoring** — bullish/bearish/neutral with emoji indicators

### 🔔 Price Alerts
- **8 active alerts** configured:
  - PTPS @ 175 (buy opportunity)
  - PTPS @ 150 (stop loss zone)
  - PGEO @ 950 (staged entry)
  - PGEO @ 1100 (breakout → target 1,662)
  - ESSA @ 750 (recovery)
  - ITMG @ 25,500 (re-entry)
  - Coal @ $140 (spike alert)
  - CPO @ RM 4,000 (B50 support)
- **Cooldown + hysteresis** — no spam, 2% reset threshold
- **Discord notifications** — DM when thresholds hit

### 📅 Earnings Calendar
- **Q1 2026 watch** — PTPS (Apr 30), PGEO (Apr 24), ADRO (May 5), ITMG (May 7)
- **PTPS special focus** — monitoring for CALK 15(c), Pihak Berelasi, Utang Usaha
- **Auto-scraper** — checks pertamina-ptk.com daily for Q1 release

### 📱 PWA Support
- **Installable app** — add to home screen (iOS/Android)
- **Offline support** — Service Worker with background sync
- **Mobile-first** — responsive design, 44px touch targets

### 🤖 Automation
- **OpenClaw heartbeat** — Elesis bot scrapes live prices every 5 min during market hours
- **GitHub Actions** — auto-build & deploy to Cloudflare Pages on every commit
- **Zero-cost stack** — GitHub + Cloudflare Pages = $0/month

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| **Static Site** | [11ty (Eleventy)](https://www.11ty.dev/) — Nunjucks templates |
| **Styling** | Vanilla CSS — mobile-first, no framework |
| **Data** | JSON files (`stock-prices.json`, `commodities.json`, `alerts.json`) |
| **Scrapers** | Node.js — Yahoo Finance API, RSS feeds, web scraping |
| **Hosting** | Cloudflare Pages (free tier) |
| **CI/CD** | GitHub Actions |
| **Bot** | Elesis via OpenClaw — live price updates, news summarization |

---

## 🚧 Missing / Future Features

### 🔴 High Priority (Decision-Impacting)

| Feature | Why It Matters | Effort |
|---------|----------------|--------|
**Historical P&L chart** | See daily/weekly portfolio performance trends, not just current snapshot | 2h
**Earnings alert (PTPS Q1)** | Auto-notify when Q1 2026 PDF drops with CALK 15c analysis | 1h (already built, needs webhook)
**Dividend calendar** | Coal plays (ADRO, ITMG) = dividend thesis. Ex-dates, yields, payout ratios | 3h
**Position sizing calculator** | "If I add X lots at Y price, what's my new avg?" | 2h
**Correlation matrix** | See if PTPS/PGEO/ESSA move together or offset each other | 4h

### 🟡 Medium Priority (Convenience)

| Feature | Why It Matters | Effort |
|---------|----------------|--------|
**Transaction logging** | Log buys/sells, track realized P&L, not just unrealized | 3h
**News sentiment trend** | 7-day bullish/bearish ratio chart for IHSG & your tickers | 4h
**Watchlist (non-holdings)** | Track ISSP, ELSA, etc. without adding to portfolio | 2h
**Mobile app (Capacitor)** | Better than PWA — native push, offline charts | 4h
**Backup price source** | TradingView API when Yahoo blocks (happens sometimes) | 2h

### 🟢 Nice to Have (Long-term)

| Feature | Why It Matters | Effort |
|---------|----------------|--------|
**Fundamental data** | PER, PBV, ROE for value screening (ISSP at PER 5.95) | 4h
**Technical charts** | Simple MA crossover alerts, RSI for entry timing | 6h
**Options flow** | Unusual call/put volume on IDX (if data available) | 8h (may not exist)
**Foreign flow by ticker** | Which stocks are foreigners buying/selling today | 3h (if IDX data free)
**Analyst consensus** | Target prices, EPS estimates, rating changes | 4h (scraping + storage)

---

## 🎯 Quick Wins (Do This Week)

1. **Historical P&L chart** — Biggest gap. You can't see if you're +10% this week or -5%.
2. **Dividend calendar** — Coal thesis is dividend-driven. Missing ex-div dates = missed plays.
3. **Position size calculator** — Manual math is error-prone when adding to positions.

---

## 🚀 Development

```bash
# Install dependencies
npm install

# Dev server (11ty)
npm run dev

# Build for production
npm run build

# Output goes to ./_site/
```

---

## 🤖 How Live Updates Work

1. **Elesis (OpenClaw session)** runs every 5 min during IDX hours
2. Fetches live prices from Yahoo Finance API (residential IP, not blocked)
3. Updates `src/content/data/stock-prices.json`
4. Commits & pushes to `main`
5. **GitHub Actions** auto-builds & deploys to Cloudflare Pages
6. Site auto-refreshes every 5 min for users during market hours

---

## 📊 Data Sources

| Data | Source | Update Frequency |
|------|--------|------------------|
| IDX stock prices | Yahoo Finance API | 5 min (market hours) |
| Commodities | Manual + Exchange APIs | 30 min |
| News | Google News RSS + IDX sites | Hourly |
| Earnings dates | Corporate websites + BEI | Daily checks |

---

**Built with 💻 by Elesis | OpenClaw-powered | Zero-cost stack**
