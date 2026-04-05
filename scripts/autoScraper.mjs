#!/usr/bin/env node
/**
 * Insider Hub Scraper
 * Saves raw data to R2, creates articles for site
 * Run: node scripts/autoScraper.mjs
 */

import { getCollection } from 'astro:content';

const SCRAPE_TARGETS = [
  { name: 'google-news', query: 'coal price Newcastle Indonesia ITMG ADRO' },
  { name: 'google-news', query: 'nickel price LME Indonesia ANTM INCO' },
  { name: 'google-news', query: 'IDX Indonesia stock market news' },
  { name: 'google-news', query: 'palm oil CPO Indonesia export' },
  { name: 'google-news', query: 'crude oil Brent Pertamina' }
];

const PORTFOLIO = ['ITMG', 'ADRO', 'PTPS', 'ESSA', 'PGEO', 'ANTM', 'INCO', 'BBRI', 'BBCA', 'TLKM'];

async function scrapeNews() {
  const timestamp = new Date().toISOString();
  const dateStr = timestamp.split('T')[0];
  const timeStr = timestamp.split('T')[1].slice(0, 5).replace(':', '');
  
  console.log(`[${timestamp}] Starting scrape...`);
  
  // This runs inside Cloudflare Worker with R2_BUCKET binding
  // In local dev, uses environment or skips R2
  const runtime = globalThis.process?.env ? null : globalThis; // Detect CF Worker
  const bucket = runtime?.env?.R2_BUCKET;
  
  const results = {
    timestamp,
    sources: [],
    articles: [],
    savedToR2: false
  };
  
  for (const target of SCRAPE_TARGETS.slice(0, 3)) { // Max 3 per run
    try {
      // Search via DuckDuckGo/Brave API or fetch RSS
      const articles = await fetchNews(target.query);
      results.sources.push({ query: target.query, count: articles.length });
      results.articles.push(...articles);
    } catch (e) {
      console.error(`Failed ${target.query}:`, e.message);
    }
  }
  
  // Save raw scrape to R2: insider-hub/data/scrapes/
  if (bucket) {
    const scrapeKey = `insider-hub/data/scrapes/${dateStr}-${timeStr}-auto.json`;
    await bucket.put(scrapeKey, JSON.stringify(results), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { timestamp, articles: results.articles.length.toString() }
    });
    results.savedToR2 = true;
    console.log(`[R2] Saved raw scrape: ${scrapeKey}`);
  }
  
  // Filter portfolio-relevant
  const relevant = results.articles.filter(a => 
    PORTFOLIO.some(t => 
      a.title?.includes(t) || 
      a.snippet?.includes(t) ||
      a.tickers?.includes(t)
    )
  );
  
  // Score and queue for summarization
  const scored = relevant.map(a => ({
    ...a,
    score: scoreArticle(a),
    status: 'pending'
  })).sort((a, b) => b.score - a.score);
  
  // Return top 5 for Elesis to summarize
  return {
    scrapeSaved: results.savedToR2,
    pendingSummaries: scored.slice(0, 5),
    totalFound: results.articles.length,
    relevantFound: relevant.length
  };
}

function scoreArticle(article) {
  let score = 0;
  const text = (article.title + ' ' + article.snippet).toLowerCase();
  
  // Portfolio ticker match = +5
  PORTFOLIO.forEach(t => {
    if (text.includes(t.toLowerCase())) score += 5;
  });
  
  // Price movement keywords = +3
  const priceWords = ['surge', 'plunge', 'rally', 'crash', 'hits', 'drops', 'rises'];
  priceWords.forEach(w => { if (text.includes(w)) score += 3; });
  
  // Policy keywords = +4
  const policyWords = ['ban', 'export', 'policy', 'government', 'subsidy', 'tax'];
  policyWords.forEach(w => { if (text.includes(w)) score += 4; });
  
  // Commodity keywords = +2
  const commWords = ['coal', 'nickel', 'palm oil', 'cpo', 'lme', 'brent'];
  commWords.forEach(w => { if (text.includes(w)) score += 2; });
  
  return Math.min(score, 10);
}

async function fetchNews(query) {
  // Placeholder - in production uses web search API
  // Returns array of {title, snippet, url, date, source}
  return [];
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeNews().then(console.log).catch(console.error);
}

export { scrapeNews, scoreArticle };
