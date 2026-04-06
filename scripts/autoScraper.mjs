/**
 * Insider Hub — Auto Scraper
 * Fetches Google News RSS for IDX portfolio stocks, scores relevance,
 * deduplicates, and writes markdown articles to src/content/news/.
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

// ── Portfolio & keywords ──────────────────────────────────────────────────────

const PORTFOLIO = ['ITMG', 'ADRO', 'PTPS', 'ESSA', 'PGEO', 'ANTM', 'INCO', 'BBRI', 'BBCA', 'TLKM'];

const TICKER_META = {
  ITMG:  { name: 'Indo Tambangraya Megah', sector: 'coal',       category: 'micro' },
  ADRO:  { name: 'Adaro Energy',           sector: 'coal',       category: 'micro' },
  PTPS:  { name: 'Pertamina Trans',        sector: 'energy',     category: 'micro' },
  ESSA:  { name: 'ESSA Industries',        sector: 'nickel',     category: 'micro' },
  PGEO:  { name: 'Pertamina Geothermal',   sector: 'energy',     category: 'micro' },
  ANTM:  { name: 'Aneka Tambang',          sector: 'mining',     category: 'micro' },
  INCO:  { name: 'Vale Indonesia',         sector: 'nickel',     category: 'micro' },
  BBRI:  { name: 'Bank Rakyat Indonesia',  sector: 'banking',    category: 'micro' },
  BBCA:  { name: 'Bank Central Asia',      sector: 'banking',    category: 'micro' },
  TLKM:  { name: 'Telkom Indonesia',       sector: 'telecom',    category: 'micro' },
};

// Google News RSS queries — mix of ticker-specific and macro IDX topics
const RSS_QUERIES = [
  // Portfolio tickers — Mainstream News
  { q: 'ITMG "Indo Tambangraya" saham',       tickers: ['ITMG'],        category: 'micro' },
  { q: 'ADRO Adaro "Alamtri" saham',          tickers: ['ADRO'],        category: 'micro' },
  { q: 'ANTM "Aneka Tambang" nikel emas',     tickers: ['ANTM'],        category: 'micro' },
  { q: 'INCO Vale Indonesia nickel',          tickers: ['INCO'],        category: 'micro' },
  { q: 'ESSA Industries nickel Indonesia',    tickers: ['ESSA'],        category: 'micro' },
  { q: 'PGEO Pertamina Geothermal IPO',       tickers: ['PGEO'],        category: 'micro' },
  { q: 'BBRI "Bank Rakyat" saham kredit',     tickers: ['BBRI'],        category: 'micro' },
  { q: 'BBCA "Bank Central Asia" saham',      tickers: ['BBCA'],        category: 'micro' },
  { q: 'TLKM Telkom Indonesia',               tickers: ['TLKM'],        category: 'micro' },
  
  // Twitter/X Social Sentiment — Portfolio Tickers
  { q: 'ITMG twitter OR x.com OR tweet saham batubara', tickers: ['ITMG'], category: 'micro', source_type: 'twitter' },
  { q: 'ADRO twitter OR x.com OR tweet saham',        tickers: ['ADRO'], category: 'micro', source_type: 'twitter' },
  { q: 'ESSA twitter OR x.com OR nickel stainless',  tickers: ['ESSA'], category: 'micro', source_type: 'twitter' },
  { q: 'PTPS twitter OR x.com Pertamina',          tickers: ['PTPS'], category: 'micro', source_type: 'twitter' },
  { q: 'PGEO twitter OR x.com Pertamina Geothermal', tickers: ['PGEO'], category: 'micro', source_type: 'twitter' },
  { q: 'ANTM twitter OR x.com nikel',              tickers: ['ANTM'], category: 'micro', source_type: 'twitter' },
  { q: 'BBRI twitter OR x.com bank saham',         tickers: ['BBRI'], category: 'micro', source_type: 'twitter' },
  { q: 'BBCA twitter OR x.com bank saham',         tickers: ['BBCA'], category: 'micro', source_type: 'twitter' },
  
  // Twitter/X — Macro & Market Sentiment
  { q: 'IHSG twitter OR x.com OR tweet "Indonesia stock"', tickers: [], category: 'macro', source_type: 'twitter' },
  { q: 'IDX twitter OR x.com "Bursa Efek Indonesia"',    tickers: [], category: 'macro', source_type: 'twitter' },
  { q: 'coal twitter OR x.com OR tweet Newcastle harga', tickers: ['ITMG','ADRO'], category: 'macro', source_type: 'twitter' },
  { q: 'nickel twitter OR x.com OR tweet LME harga',     tickers: ['ANTM','INCO','ESSA'], category: 'macro', source_type: 'twitter' },
  
  // Twitter/X — Broader Economic & Policy
  { q: 'China economy twitter OR x.com demand commodity', tickers: ['ITMG','ADRO','ANTM','INCO','ESSA'], category: 'macro', source_type: 'twitter' },
  { q: 'Fed rate twitter OR x.com interest USD IDR',      tickers: [], category: 'macro', source_type: 'twitter' },
  { q: 'tariff trump twitter OR x.com Indonesia trade',   tickers: [], category: 'macro', source_type: 'twitter' },
  { q: 'inflasi twitter OR x.com OR inflation BI rate',  tickers: [], category: 'macro', source_type: 'twitter' },
  { q: 'rupiah twitter OR x.com OR IDR USD exchange',     tickers: [], category: 'macro', source_type: 'twitter' },
  
  // Macro — Core Market
  { q: 'IDX IHSG stock market Indonesia',     tickers: [],              category: 'macro' },
  { q: 'coal price Newcastle Indonesia export',tickers: ['ITMG','ADRO','PTBA'], category: 'macro' },
  { q: 'nickel price LME Indonesia 2026',     tickers: ['ANTM','INCO','ESSA'], category: 'macro' },
  { q: 'palm oil CPO price Malaysia Indonesia',tickers: [],             category: 'macro' },
  { q: 'Bank Indonesia BI rate rupiah',       tickers: [],              category: 'macro' },
  { q: 'Trump tariff Indonesia economy 2026', tickers: [],              category: 'macro' },
  { q: 'Indonesia GDP growth 2026',           tickers: [],              category: 'macro' },
  
  // Macro — China Demand (Affects all commodities)
  { q: 'China steel demand 2026 Indonesia coal nickel', tickers: ['ITMG','ADRO','ANTM','INCO','ESSA'], category: 'macro' },
  { q: 'China stimulus property steel stainless', tickers: ['ITMG','ADRO','ESSA'], category: 'macro' },
  { q: 'China PMI manufacturing commodity import', tickers: ['ITMG','ADRO','ANTM','INCO'], category: 'macro' },
  
  // Macro — Fed & Global Rates
  { q: 'Fed interest rate decision 2026 impact', tickers: [], category: 'macro' },
  { q: 'US dollar strength rupiah IDR weakness', tickers: [], category: 'macro' },
  { q: 'Treasury yield emerging market capital flow', tickers: [], category: 'macro' },
  
  // Macro — Trade & Geopolitics
  { q: 'Trump tariff trade war Indonesia export', tickers: [], category: 'macro' },
  { q: 'US China trade deal commodity price', tickers: ['ITMG','ADRO','ANTM','INCO'], category: 'macro' },
  { q: 'sanctions Russia energy coal alternative', tickers: ['ITMG','ADRO'], category: 'macro' },
  
  // Macro — Indonesia Policy
  { q: 'Indonesia export ban mineral nickel coal policy', tickers: ['ANTM','INCO','ESSA','ITMG','ADRO'], category: 'macro' },
  { q: 'Bahlil energy policy Indonesia mining', tickers: ['ITMG','ADRO','ANTM','PTPS','PGEO'], category: 'macro' },
  { q: 'Indonesia renewable energy transition coal', tickers: ['ITMG','ADRO','PGEO'], category: 'macro' },
  
  // Macro — Regional Markets
  { q: 'Malaysia KLCI Singapore STI Thailand SET correlation', tickers: [], category: 'macro' },
  { q: 'ASEAN market foreign fund flow institutional', tickers: [], category: 'macro' },
  { q: 'MSCI EM Asia Indonesia index inclusion', tickers: [], category: 'macro' },
  
  // Macro — Currency & Inflation
  { q: 'rupiah depreciation IDR USD 16000 BI intervention', tickers: [], category: 'macro' },
  { q: 'Indonesia inflation CPI 2026 food energy price', tickers: [], category: 'macro' },
  { q: 'fuel subsidy BBM Pertamina hike policy', tickers: ['PTPS','PGEO'], category: 'macro' },
  
  // Asia Business — Nikkei Asia
  { q: 'site:nikkei.com Indonesia coal nickel mining', tickers: ['ITMG','ADRO','ANTM','INCO','ESSA'], category: 'macro' },
  { q: 'site:nikkei.com Indonesia energy Pertamina', tickers: ['PTPS','PGEO'], category: 'macro' },
  { q: 'site:nikkei.com Indonesia banking finance', tickers: ['BBRI','BBCA'], category: 'macro' },
  { q: 'site:nikkei.com ASEAN market trade economy', tickers: [], category: 'macro' },
  { q: 'site:nikkei.com China economy commodity demand', tickers: ['ITMG','ADRO','ANTM','INCO','ESSA'], category: 'macro' },
];

// Nitter (Twitter/X RSS mirror) feeds — Key accounts
// Note: Nitter instances change frequently, rotating through working instances
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.cz', 
  'https://nitter.poast.org',
  'https://nitter.mint.lgbt',
  'https://nitter.esmailelbob.xyz'
];

const NITTER_FEEDS = [
  // Official accounts
  { handle: 'idx_bei',           name: 'IDX Official',      tickers: [],     category: 'macro' },
  { handle: 'BEI_Corporate',     name: 'BEI Corporate',     tickers: [],     category: 'micro' },
  { handle: 'bank_indonesia',    name: 'Bank Indonesia',    tickers: [],     category: 'macro' },
  { handle: 'kemenkeuRI',        name: 'Kemenkeu',          tickers: [],     category: 'macro' },
  { handle: 'purbayasadewa',     name: 'Purbaya Finance',   tickers: [],     category: 'macro' },
  
  // Energy/Mining/Policy
  { handle: 'Pertamina',         name: 'Pertamina',         tickers: ['PTPS','PGEO'], category: 'micro' },
  { handle: 'AntamOfficial',     name: 'Antam ANTM',        tickers: ['ANTM'], category: 'micro' },
  { handle: 'ESDM_RI',           name: 'ESDM Ministry',     tickers: ['ITMG','ADRO','PTPS','PGEO'], category: 'macro' },
  { handle: 'BahlilLahadalia',   name: 'Bahlil ESDM',       tickers: ['ITMG','ADRO','ANTM','PTPS','PGEO'], category: 'macro' },
  
  // Macro/Economic Research
  { handle: 'Bappenas',          name: 'Bappenas',          tickers: [],     category: 'macro' },
  { handle: 'BPS_Statistics',    name: 'BPS Statistics',    tickers: [],     category: 'macro' },

  // Financial News & Analysts
  { handle: 'kontan',            name: 'Kontan',            tickers: [],     category: 'macro' },
  { handle: 'Bisniscom',         name: 'Bisnis Indonesia',  tickers: [],     category: 'macro' },
  { handle: 'investor_id',       name: 'Investor Daily',    tickers: [],     category: 'macro' },
  { handle: 'wak_research',      name: 'William Analytica', tickers: [],     category: 'macro' },
  { handle: 'FirstRevi',         name: 'First Metro',       tickers: [],     category: 'macro' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function googleNewsRssUrl(query) {
  const encoded = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encoded}&hl=en-ID&gl=ID&ceid=ID:en`;
}

async function fetchRss(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsiderHubBot/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };
    const title = get('title').replace(/\s*-\s*[^-]+$/, '').trim(); // strip source suffix
    const link  = get('link');
    const pubDate = get('pubDate');
    const description = get('description')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
    const source = get('source') || block.match(/<source[^>]*>([^<]+)<\/source>/)?.[1] || '';

    if (title && link) {
      items.push({ title, link, pubDate, description, source });
    }
  }
  return items;
}

function slug(title, date) {
  const dateStr = date.toISOString().split('T')[0];
  const clean = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
  return `${dateStr}-${clean}`;
}

function fingerprint(title) {
  return createHash('md5').update(title.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 12);
}

function scoreRelevance(text, hintTickers) {
  const t = text.toLowerCase();
  let score = 0;
  const reasons = [];

  // +3 portfolio ticker match
  const tickerHits = PORTFOLIO.filter(tk =>
    t.includes(tk.toLowerCase()) ||
    t.includes((TICKER_META[tk]?.name || '').toLowerCase())
  );
  if (tickerHits.length > 0) {
    score += 3;
    reasons.push(`tickers(${tickerHits.join(',')})`);
  }

  // +2 hint tickers (query-specific)
  if (hintTickers.length > 0 && hintTickers.some(tk => t.includes(tk.toLowerCase()))) {
    score += 2;
    reasons.push('hint-ticker');
  }

  // +2 sector keywords
  const sectorWords = ['coal', 'batu bara', 'nickel', 'nikel', 'palm oil', 'cpo', 'geothermal',
                       'banking', 'perbankan', 'telecom', 'mining', 'tambang', 'energy', 'energi'];
  if (sectorWords.some(w => t.includes(w))) {
    score += 2;
    reasons.push('sector');
  }

  // +2 IDX / Indonesia market mentions
  const idxWords = ['ihsg', 'idx', 'bursa efek', 'indonesia stock', 'saham indonesia', 'bei'];
  if (idxWords.some(w => t.includes(w))) {
    score += 2;
    reasons.push('idx');
  }

  // +2 price action / financial event
  const actionWords = ['naik', 'turun', 'rally', 'surge', 'drop', 'crash', 'earnings', 'laba',
                       'revenue', 'profit', 'loss', 'rugi', 'dividen', 'dividend', 'buyback',
                       'ipo', 'rights issue', 'target price', 'upgrade', 'downgrade'];
  if (actionWords.some(w => t.includes(w))) {
    score += 2;
    reasons.push('action');
  }

  // +1 earnings / corporate events
  const corpWords = ['quarterly', 'triwulan', 'annual', 'tahunan', 'rups', 'rupst', 'agm',
                     'analyst', 'rekomendasi', 'recommendation'];
  if (corpWords.some(w => t.includes(w))) {
    score += 1;
    reasons.push('corp-event');
  }

  // -2 generic market noise (no specific company or sector)
  const noiseWords = ['global market', 'wall street', 'dow jones', 'crypto', 'bitcoin',
                      'forex tips', 'trading signal', 'free webinar'];
  if (noiseWords.some(w => t.includes(w)) && tickerHits.length === 0) {
    score -= 2;
    reasons.push('noise(-2)');
  }

  return { score, reasons };
}

function detectImpact(text) {
  const t = text.toLowerCase();
  const positive = ['naik', 'rally', 'surge', 'jump', 'rise', 'gain', 'profit', 'laba', 'bullish',
                    'buy', 'upgrade', 'outperform', 'record', 'high', 'buyback', 'dividen', 'dividend'];
  const negative = ['turun', 'drop', 'fall', 'crash', 'decline', 'loss', 'rugi', 'bearish',
                    'sell', 'downgrade', 'underperform', 'low', 'ban', 'tariff', 'sanction', 'risk'];
  const posScore = positive.filter(w => t.includes(w)).length;
  const negScore = negative.filter(w => t.includes(w)).length;
  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

function detectTickers(text, hintTickers) {
  const found = new Set(hintTickers);
  const t = text.toUpperCase();
  for (const ticker of PORTFOLIO) {
    if (t.includes(ticker) || t.includes(TICKER_META[ticker]?.name?.toUpperCase() || '')) {
      found.add(ticker);
    }
  }
  return [...found];
}

function detectRegion(text) {
  const t = text.toLowerCase();
  if (t.includes('ihsg') || t.includes('idx') || t.includes('bursa efek')) return 'IDX';
  if (t.includes('indonesia')) return 'Indonesia';
  if (t.includes('malaysia') || t.includes('singapore')) return 'Asia';
  if (t.includes('china') || t.includes('us ') || t.includes('fed ')) return 'Global';
  return 'Indonesia';
}

function buildMarkdown({ title, date, category, impact, region, tickers, source, url, description }) {
  const tickersJson = JSON.stringify(tickers);
  const safeTitle = title.replace(/"/g, '\\"');
  const safeSource = (source || 'Google News').replace(/"/g, '\\"');
  const safeUrl = url || '';

  const body = description
    ? `## Summary\n\n${description}\n\n---\n\n*Auto-scraped by Insider Hub Bot · [Source](${safeUrl})*`
    : `*Auto-scraped by Insider Hub Bot · [Source](${safeUrl})*`;

  return `---
title: "${safeTitle}"
date: "${date.toISOString()}"
category: ${category}
impact: ${impact}
region: ${region}
tickers: ${tickersJson}
source: "${safeSource}"
url: "${safeUrl}"
---

${body}
`;
}

function buildPendingMarkdown({ title, date, category, impact, region, tickers, source, url, description, queryTickers }) {
  const tickersJson = JSON.stringify(tickers);
  const safeTitle = title.replace(/"/g, '\\"');
  const safeSource = (source || 'Google News').replace(/"/g, '\\"');
  const safeUrl = url || '';
  const queryTickersJson = JSON.stringify(queryTickers);

  // Raw RSS data for Elesis to process
  return `---
title: "${safeTitle}"
date: "${date.toISOString()}"
category: ${category}
impact: ${impact}
region: ${region}
tickers: ${tickersJson}
query_tickers: ${queryTickersJson}
source: "${safeSource}"
url: "${safeUrl}"
status: "pending"
scraped_at: "${new Date().toISOString()}"
---

## Raw RSS Summary

${description || 'No description available.'}

## Source URL

${safeUrl}

## Processing Notes

- Priority: ${tickers.some(t => ['ITMG', 'ADRO', 'ESSA', 'PTPS', 'PGEO'].includes(t)) ? 'HIGH (portfolio)' : 'NORMAL'}
- Action needed: Fetch full article and summarize

---

*Pending summarization by Elesis 💻 · [View Source](${safeUrl})*
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function scrapeNews() {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting scrape...`);

  const newsDir = 'src/content/news';
  const pendingDir = 'src/content/news/.pending';
  const cacheDir = '.cache';

  await mkdir(cacheDir, { recursive: true });
  await mkdir(pendingDir, { recursive: true });

  // Load existing article fingerprints to avoid duplicates
  const existing = await readdir(newsDir).catch(() => []);
  const existingTitles = new Set();
  for (const file of existing) {
    try {
      const content = await readFile(`${newsDir}/${file}`, 'utf8');
      const titleMatch = content.match(/^title:\s*"(.+)"/m);
      if (titleMatch) existingTitles.add(fingerprint(titleMatch[1]));
    } catch {}
  }
  console.log(`Existing articles: ${existing.length}`);

  // Load cache of seen URLs
  const cacheFile = `${cacheDir}/seen-urls.json`;
  let seenUrls = new Set();
  try {
    const raw = await readFile(cacheFile, 'utf8');
    seenUrls = new Set(JSON.parse(raw));
  } catch {}

  const created = [];
  const errors = [];

  for (const query of RSS_QUERIES) {
    const url = googleNewsRssUrl(query.q);
    console.log(`  Fetching: ${query.q}`);

    let xml;
    try {
      xml = await fetchRss(url);
    } catch (e) {
      console.warn(`  ✗ Failed: ${e.message}`);
      errors.push({ query: query.q, error: e.message });
      continue;
    }

    const items = parseRssItems(xml);
    console.log(`  → ${items.length} items`);

    for (const item of items.slice(0, 5)) { // max 5 per query
      // Skip if URL already seen
      if (seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);

      // Skip if title already exists
      const fp = fingerprint(item.title);
      if (existingTitles.has(fp)) continue;
      existingTitles.add(fp);

      // Skip very short or generic titles
      if (item.title.length < 20) continue;

      const date = item.pubDate ? new Date(item.pubDate) : new Date();
      if (isNaN(date.getTime())) continue;

      // Skip articles older than 7 days
      const ageMs = Date.now() - date.getTime();
      if (ageMs > 7 * 24 * 60 * 60 * 1000) continue;

      const fullText = `${item.title} ${item.description}`;

      // Score relevance — skip low-signal articles
      const { score, reasons } = scoreRelevance(fullText, query.tickers);
      if (score < 4) {
        console.log(`  ↷ Skip (score ${score}): ${item.title.slice(0, 60)}`);
        continue;
      }

      const tickers  = detectTickers(fullText, query.tickers);
      const impact   = detectImpact(fullText);
      const region   = detectRegion(fullText);
      const category = query.category;
      const source   = item.source || 'Google News';

      const filename = `${slug(item.title, date)}.md`;
      
      // High-value articles (score >= 6 or portfolio tickers) → pending for Elesis to summarize
      const isHighValue = score >= 6 || tickers.some(t => ['ITMG', 'ADRO', 'ESSA', 'PTPS', 'PGEO'].includes(t));
      
      if (isHighValue) {
        // Save to pending for Elesis summarization
        const pendingPath = `${pendingDir}/${filename}`;
        if (existsSync(pendingPath)) continue;
        
        const pendingMarkdown = buildPendingMarkdown({
          title: item.title,
          date,
          category,
          impact,
          region,
          tickers,
          source,
          url: item.link,
          description: item.description,
          queryTickers: query.tickers
        });
        
        await writeFile(pendingPath, pendingMarkdown);
        created.push({ file: filename, title: item.title, score, pending: true });
        console.log(`  ✓ Pending (score ${score}): ${item.title.slice(0, 60)}`);
        continue;
      }
      
      // Lower-value articles → publish directly with RSS summary only
      const filepath = `${newsDir}/${filename}`;
      if (existsSync(filepath)) continue;

      const markdown = buildMarkdown({
        title: item.title,
        date,
        category,
        impact,
        region,
        tickers,
        source,
        url: item.link,
        description: item.description,
      });

      await writeFile(filepath, markdown, 'utf8');
      created.push(filename);
      console.log(`  ✓ [${score}] Created: ${filename}`);
    }

    // Small delay between requests to be polite
    await new Promise(r => setTimeout(r, 500));
  }

  // ── Fetch Twitter/X via Nitter RSS ───────────────────────────────────────────

  // Helper to try multiple Nitter instances
  async function fetchNitterWithFallback(handle) {
    for (const instance of NITTER_INSTANCES) {
      try {
        const url = `${instance}/${handle}/rss`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsiderHubBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) return await res.text();
      } catch (e) {
        // Try next instance
        continue;
      }
    }
    throw new Error('All Nitter instances failed');
  }
  console.log('\n  Fetching Twitter/X via Nitter...');
  
  for (const feed of NITTER_FEEDS) {
    console.log(`    Feed: ${feed.name} (@${feed.handle})`);
    
    let xml;
    try {
      xml = await fetchNitterWithFallback(feed.handle);
    } catch (e) {
      console.warn(`      ✗ Nitter failed (all instances): ${e.message}`);
      errors.push({ nitter: feed.name, handle: feed.handle, error: e.message });
      continue;
    }
    
    const items = parseRssItems(xml);
    console.log(`      → ${items.length} tweets`);
    
    for (const item of items.slice(0, 3)) { // max 3 per account
      // Skip if URL already seen
      if (seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);
      
      // Skip if title already exists
      const fp = fingerprint(item.title);
      if (existingTitles.has(fp)) continue;
      existingTitles.add(fp);
      
      const date = item.pubDate ? new Date(item.pubDate) : new Date();
      if (isNaN(date.getTime())) continue;
      
      // Skip tweets older than 2 days (Twitter is fast-moving)
      const ageMs = Date.now() - date.getTime();
      if (ageMs > 2 * 24 * 60 * 60 * 1000) continue;
      
      const fullText = `${item.title} ${item.description}`;
      
      // Score for Twitter — lower threshold, focus on relevance
      const { score, reasons } = scoreRelevance(fullText, feed.tickers);
      // Boost score for official accounts
      const boostedScore = score + (['IDX Official', 'Bank Indonesia', 'BEI Corporate'].includes(feed.name) ? 2 : 0);
      
      if (boostedScore < 3) {
        console.log(`      ↷ Skip tweet (score ${boostedScore}): ${item.title.slice(0, 40)}`);
        continue;
      }
      
      const tickers = detectTickers(fullText, feed.tickers);
      const impact = detectImpact(fullText);
      const region = 'Indonesia';
      const category = feed.category;
      const source = `Twitter/X (${feed.name})`;
      
      const filename = `${slug(item.title, date)}.md`;
      
      // Twitter posts from official accounts → always high value
      const isOfficial = ['IDX Official', 'Bank Indonesia', 'BEI Corporate', 'Kemenkeu'].includes(feed.name);
      const isHighValue = boostedScore >= 5 || isOfficial || tickers.some(t => ['ITMG', 'ADRO', 'ESSA', 'PTPS', 'PGEO'].includes(t));
      
      if (isHighValue) {
        const pendingPath = `${pendingDir}/${filename}`;
        if (existsSync(pendingPath)) continue;
        
        const pendingMarkdown = buildPendingMarkdown({
          title: item.title,
          date,
          category,
          impact,
          region,
          tickers,
          source,
          url: item.link,
          description: item.description,
          queryTickers: feed.tickers
        });
        
        await writeFile(pendingPath, pendingMarkdown);
        created.push({ file: filename, title: item.title, score: boostedScore, pending: true, source: 'twitter' });
        console.log(`      ✓ Pending tweet (score ${boostedScore}): ${item.title.slice(0, 40)}`);
        continue;
      }
      
      // Lower-priority tweets → direct publish
      const filepath = `${newsDir}/${filename}`;
      if (existsSync(filepath)) continue;
      
      const markdown = buildMarkdown({
        title: item.title,
        date,
        category,
        impact,
        region,
        tickers,
        source,
        url: item.link,
        description: item.description,
      });
      
      await writeFile(filepath, markdown, 'utf8');
      created.push({ file: filename, title: item.title, score: boostedScore, source: 'twitter' });
      console.log(`      ✓ [${boostedScore}] Tweet: ${filename}`);
    }
    
    // Delay between Nitter feeds
    await new Promise(r => setTimeout(r, 1000));
  }

  // Save updated URL cache
  await writeFile(cacheFile, JSON.stringify([...seenUrls], null, 2), 'utf8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s — ${created.length} new articles, ${errors.length} errors`);
  if (created.length) console.log('Created:', created);
  if (errors.length)  console.log('Errors:', errors);

  return { created, errors };
}

// Run
scrapeNews()
  .then(r => process.exit(r.errors.length > 0 && r.created.length === 0 ? 1 : 0))
  .catch(e => { console.error('Fatal:', e); process.exit(1); });
