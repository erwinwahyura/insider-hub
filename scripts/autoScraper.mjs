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
  // Portfolio tickers
  { q: 'ITMG "Indo Tambangraya" saham',       tickers: ['ITMG'],        category: 'micro' },
  { q: 'ADRO Adaro "Alamtri" saham',          tickers: ['ADRO'],        category: 'micro' },
  { q: 'ANTM "Aneka Tambang" nikel emas',     tickers: ['ANTM'],        category: 'micro' },
  { q: 'INCO Vale Indonesia nickel',          tickers: ['INCO'],        category: 'micro' },
  { q: 'ESSA Industries nickel Indonesia',    tickers: ['ESSA'],        category: 'micro' },
  { q: 'PGEO Pertamina Geothermal IPO',       tickers: ['PGEO'],        category: 'micro' },
  { q: 'BBRI "Bank Rakyat" saham kredit',     tickers: ['BBRI'],        category: 'micro' },
  { q: 'BBCA "Bank Central Asia" saham',      tickers: ['BBCA'],        category: 'micro' },
  { q: 'TLKM Telkom Indonesia',               tickers: ['TLKM'],        category: 'micro' },
  // Macro
  { q: 'IDX IHSG stock market Indonesia',     tickers: [],              category: 'macro' },
  { q: 'coal price Newcastle Indonesia export',tickers: ['ITMG','ADRO','PTBA'], category: 'macro' },
  { q: 'nickel price LME Indonesia 2026',     tickers: ['ANTM','INCO','ESSA'], category: 'macro' },
  { q: 'palm oil CPO price Malaysia Indonesia',tickers: [],             category: 'macro' },
  { q: 'Bank Indonesia BI rate rupiah',       tickers: [],              category: 'macro' },
  { q: 'Trump tariff Indonesia economy 2026', tickers: [],              category: 'macro' },
  { q: 'Indonesia GDP growth 2026',           tickers: [],              category: 'macro' },
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
