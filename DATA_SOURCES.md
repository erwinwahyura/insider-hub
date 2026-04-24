# Smart Money Data Sources — Implementation Guide

## Current Status

| Source | Status | Reliability | Delay | Priority |
|--------|--------|-------------|-------|----------|
| **Broker APIs** | ⏳ Credentials Required | High | Real-time | P0 |
| **IDX Website** | ❌ Cloudflare Blocked | High | 15-30 min | P1 |
| **Stockbit Social** | ⏳ JS-Heavy Site | Medium | 15-30 min | P2 |
| **Telegram Channels** | ⏳ Bot Setup Required | Medium | 5-15 min | P2 |
| **RSS News** | ✅ Active | High | 30-60 min | P3 |
| **Twitter/X** | ❌ Nitter Down | Low | Real-time | P4 |

---

## 1. Local Broker Feeds (PRIMARY — INDONESIA FOCUS)

### Indo Premier Sekuritas (MOST ACCESSIBLE)
```bash
# Contact: api@indopremier.com
# Phone: 021-5080-1888
# API Docs: https://api.indopremier.com/v2
# Cost: FREE for account holders

Required Credentials:
- API Key (from online trading platform)
- User ID (trading account number)
- Password (trading PIN)

Endpoints:
GET /api/v2/foreign-flow?date={YYYY-MM-DD}
GET /api/v2/broker-summary?broker_code={CODE}
GET /api/v2/top-gainers?date={YYYY-MM-DD}
GET /api/v2/block-trades?min_value=10000000000

Rate Limit: 80 req/min
Data Delay: 5-15 minutes (near real-time)
```

### Sinarmas Sekuritas
```bash
# Contact: callcenter@sinarmassekuritas.co.id
# Phone: 021-250-6000
# Web: https://www.sinarmassekuritas.co.id
# Cost: FREE for account holders

Required Credentials:
- Online trading account
- API access request (email support)

Endpoints:
GET /api/v1/market/foreign-net
GET /api/v1/market/broker-activity
GET /api/v1/market/large-trades

Rate Limit: 60 req/min
Data Delay: 10-20 minutes
```

### Panin Sekuritas
```bash
# Contact: customercare@panin.co.id
# Phone: 021-5793-8888
# Web: https://www.paninsekuritas.co.id
# Cost: FREE for account holders

Required Credentials:
- Panin API Key (request via online trading)
- Client Code

Endpoints:
GET /api/market/foreign-flow
GET /api/market/top-brokers
GET /api/market/block-transactions

Rate Limit: 50 req/min
Data Delay: 10-20 minutes
```

### Phillip Sekuritas Indonesia
```bash
# Contact: support@phillip.co.id
# Phone: 021-5799-8888
# API Docs: https://developer.phillip.co.id
# Cost: FREE for account holders

Required Credentials:
- Access Token (from POEMS platform)
- Refresh Token

Endpoints:
GET /market/foreign-net?tickers={COMMA_SEPARATED}
GET /market/institutional-flow?sector={SECTOR}
GET /market/block-trades

Rate Limit: 120 req/min
Data Delay: 5-15 minutes
```

### Mirae Asset Sekuritas (INSTITUTIONAL FOCUS)
```bash
# Contact: institutional@miraeasset.co.id
# Phone: 021-2988-5888
# API Docs: https://developer.miraeasset.co.id
# Cost: FREE for active traders (min Rp 100M/month volume)

Required Credentials:
- Client ID
- API Key  
- API Secret

Endpoints:
GET /v1/market/foreign-flow?ticker={TICKER}&date={YYYY-MM-DD}
GET /v1/market/block-trades?min_value=10000000000
GET /v1/market/top-brokers?date={YYYY-MM-DD}

Rate Limit: 100 req/min
Data Delay: Real-time (institutional feed)
```

### NH Korindo Sekuritas (INSTITUTIONAL)
```bash
# Contact: api@nhkorindo.co.id
# Phone: 021-2988-9999
# API Docs: https://api.nhkorindo.co.id/docs
# Cost: FREE for institutional clients

Required Credentials:
- API Key
- Client Certificate (.pem)

Endpoints:
GET /api/foreign-ownership?ticker={TICKER}
GET /api/large-transactions?date={YYYY-MM-DD}

Rate Limit: 60 req/min
Data Delay: Real-time
```

### Phillip Sekuritas Indonesia
```bash
# Contact: support@phillip.co.id
# API Docs: https://developer.phillip.co.id

Required Credentials:
- Access Token
- Refresh Token

Endpoints:
GET /market/foreign-net?tickers={COMMA_SEPARATED}
GET /market/institutional-flow?sector={SECTOR}

Rate Limit: 120 req/min
```

### Indo Premier Sekuritas
```bash
# Contact: api@indopremier.com
# API Docs: https://api.indopremier.com/v2

Required Credentials:
- API Key
- User ID

Endpoints:
GET /api/v2/foreign-flow?date={YYYY-MM-DD}
GET /api/v2/broker-summary?broker_code={CODE}

Rate Limit: 80 req/min
```

---

## 2. IDX Website Scraping (FALLBACK)

### Challenge
- Cloudflare protection (Ray ID blocked)
- Dynamic JavaScript content
- Aggressive rate limiting

### Solution
```bash
# Requirements
npm install playwright puppeteer-extra puppeteer-extra-plugin-stealth

# Proxy Configuration (Residential)
PROVIDER=brightdata|oxylabs|smartproxy
HOST=brd.superproxy.io
PORT=22225
USERNAME=your_proxy_user
PASSWORD=your_proxy_pass

# Implementation
1. Use stealth plugins to bypass bot detection
2. Rotate proxy for each request
3. Persist cookies across sessions
4. Cache results (15-min TTL)
5. Respect rate limits (1 req/5 sec)
```

### Target URLs
| Data Type | URL | Selector |
|-----------|-----|----------|
| Foreign Ownership | /en/market-data/trading-summary/foreign-ownership | .foreign-ownership-table |
| Broker Summary | /en/market-data/trading-summary/broker-summary | .broker-summary-table |
| Block Trades | /en/market-data/trading-summary/block-trades | .block-trade-table |

---

## 3. Stockbit Social Scraping (ALTERNATIVE)

### Approach
```javascript
// Stockbit uses React/Next.js — need to:
1. Use headless browser (Playwright)
2. Wait for JS hydration
3. Extract from DOM after render
4. Handle infinite scroll

Target Pages:
- /symbol/{TICKER}/stream — ticker-specific discussions
- /stream — general market sentiment
- /broker-summary — broker activity (if available)
```

### Data Points
- Foreign flow mentions in comments
- Broker code discussions
- Large transaction rumors
- Institutional sentiment

---

## 4. Telegram Channel Monitoring (ALTERNATIVE)

### Channels to Monitor
| Channel | Focus | Reliability |
|---------|-------|-------------|
| @IDX_Broker_Updates | Official broker news | High |
| @Saham_ID_Flow | Foreign flow rumors | Medium |
| @BursaEfekIndonesia | Market updates | High |
| @StockbitOfficial | Platform updates | Medium |

### Implementation
```python
# Using python-telegram-bot or Telethon
from telethon import TelegramClient

client = TelegramClient('session', api_id, api_hash)

@client.on(events.NewMessage(chats=['@Saham_ID_Flow']))
async def handler(event):
    # Parse message for ticker mentions
    # Extract foreign flow data
    # Store to database
```

---

## 5. Immediate Action Items

### For Master (Hiru):
1. **Contact Brokers** — Email Mirae/NH Korindo/Phillip for API access
2. **Proxy Service** — Sign up for Bright Data or Oxylabs ($50-100/month)
3. **Telegram Bot** — Create bot token for channel monitoring

### For Elesis:
1. ✅ Broker API framework built
2. ✅ IDX scraping plan documented
3. ⏳ Implement when credentials available
4. ⏳ Deploy browser automation with proxy

---

## 6. Cost Estimate

| Solution | Monthly Cost | Reliability |
|----------|--------------|-------------|
| Broker APIs (1-2) | Free-$50 | ⭐⭐⭐⭐⭐ |
| Residential Proxy | $50-100 | ⭐⭐⭐⭐ |
| Telegram Bot | Free | ⭐⭐⭐ |
| Stockbit Scraping | Proxy cost only | ⭐⭐⭐ |
| **TOTAL** | **$50-150** | **⭐⭐⭐⭐** |

---

*Last updated: April 24, 2026 by Elesis 💻*
