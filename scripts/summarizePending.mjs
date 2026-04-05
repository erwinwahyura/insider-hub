/**
 * Article Summarizer — Elesis-powered summarization for pending news
 * 
 * Run via: node scripts/summarizePending.mjs
 * Or triggered by Elesis via heartbeat/cron
 * 
 * Flow:
 * 1. Read .pending/ files
 * 2. Fetch full article HTML via web
 * 3. Extract readable text
 * 4. Summarize (2-3 bullets + portfolio impact)
 * 5. Write clean .md to src/content/news/
 * 6. Delete .pending/ file
 */

import { readdir, readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';

const PENDING_DIR = 'src/content/news/.pending';
const NEWS_DIR = 'src/content/news';

// Portfolio for impact analysis
const PORTFOLIO = ['ITMG', 'ADRO', 'PTPS', 'ESSA', 'PGEO'];
const POSITIONS = {
  ITMG: { lots: null, avg: 28100 }, // re-entered
  PTPS: { lots: 1010, avg: 196 },
  ESSA: { lots: 310, avg: 713 },
  PGEO: { lots: 205, avg: 1011 }
};

async function fetchArticleText(url) {
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    
    // Simple article text extraction (readability-lite)
    // Remove scripts, styles, nav
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ') // strip remaining tags
      .replace(/\s+/g, ' ')
      .trim();
    
    // Get first ~3000 chars (usually covers article)
    return text.slice(0, 8000);
  } catch (e) {
    console.warn(`  ✗ Failed to fetch ${url}: ${e.message}`);
    return null;
  }
}

function extractKeyPoints(text, tickers) {
  // Simple extraction — look for sentences with numbers, prices, %
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 40);
  
  const keyPoints = [];
  const seen = new Set();
  
  for (const sentence of sentences.slice(0, 30)) {
    // Skip if too similar to existing
    const lower = sentence.toLowerCase();
    if (seen.has(lower.slice(0, 50))) continue;
    
    // Score the sentence
    let score = 0;
    if (sentence.match(/\d+%?/)) score += 2; // has numbers
    if (sentence.match(/(revenue|profit|loss|earnings|growth)/i)) score += 3;
    if (sentence.match(/(price|target|upgrade|downgrade)/i)) score += 2;
    if (tickers.some(t => sentence.includes(t))) score += 3;
    if (sentence.match(/( coal | nickel | palm oil | geothermal )/i)) score += 2;
    
    if (score >= 4 && keyPoints.length < 3) {
      keyPoints.push(sentence);
      seen.add(lower.slice(0, 50));
    }
  }
  
  return keyPoints.slice(0, 3);
}

function generatePortfolioImpact(tickers, title, points) {
  const relevantTickers = tickers.filter(t => PORTFOLIO.includes(t));
  if (relevantTickers.length === 0) return null;
  
  const impacts = [];
  for (const t of relevantTickers) {
    const pos = POSITIONS[t];
    if (!pos) continue;
    
    // Detect direction from impact
    const isNegative = points.some(p => 
      /(drop|fall|decline|loss|down|cut|delay)/i.test(p)
    );
    const isPositive = points.some(p => 
      /(rise|gain|growth|up|surge|beat|exceed)/i.test(p)
    );
    
    const emoji = isNegative ? '🔴' : isPositive ? '🟢' : '🟡';
    
    if (pos.lots) {
      const pnl = isPositive ? '+Rp XXk' : isNegative ? '-Rp XXk' : 'watch';
      impacts.push(`${emoji} **${t}**: Your ${pos.lots} lots @ ${pos.avg} — ${pnl} potential`);
    } else {
      impacts.push(`${emoji} **${t}**: Position at ${pos.avg} — ${isPositive ? 'tailwind' : isNegative ? 'headwind' : 'monitor'}`);
    }
  }
  
  return impacts.length > 0 ? impacts.join('\n') : null;
}

function buildSummarizedMarkdown(frontmatter, fullText, keyPoints, portfolioImpact) {
  const safeTitle = frontmatter.title.replace(/"/g, '\\"');
  const safeSource = frontmatter.source.replace(/"/g, '\\"');
  
  const summaryPoints = keyPoints.length > 0 
    ? keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n\n')
    : '_No key points extracted from full article._';
  
  const impactSection = portfolioImpact 
    ? `## Portfolio Impact\n\n${portfolioImpact}`
    : '';
  
  return `---
title: "${safeTitle}"
date: "${frontmatter.date}"
category: ${frontmatter.category}
impact: ${frontmatter.impact}
region: ${frontmatter.region}
tickers: ${JSON.stringify(frontmatter.tickers)}
source: "${safeSource}"
url: "${frontmatter.url}"
summarized: true
summarized_at: "${new Date().toISOString()}"
---

## Summary

${keyPoints[0] || frontmatter.title}

## Key Points

${summaryPoints}
${impactSection}

---

*Summarized by Elesis 💻 from [${frontmatter.source}](${frontmatter.url})*
`;
}

async function summarizePending() {
  console.log(`[${new Date().toISOString()}] Checking for pending articles...`);
  
  // Check if pending dir exists
  if (!existsSync(PENDING_DIR)) {
    console.log('  No pending directory — nothing to do');
    return { processed: 0, errors: [] };
  }
  
  const pendingFiles = await readdir(PENDING_DIR).catch(() => []);
  const pending = pendingFiles.filter(f => f.endsWith('.md'));
  
  console.log(`  Found ${pending.length} pending articles`);
  
  const processed = [];
  const errors = [];
  
  for (const filename of pending) {
    const pendingPath = `${PENDING_DIR}/${filename}`;
    
    try {
      console.log(`\n  Processing: ${filename}`);
      
      // Read pending file
      const content = await readFile(pendingPath, 'utf8');
      
      // Parse frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fmMatch) {
        console.warn(`  ✗ Invalid frontmatter in ${filename}`);
        errors.push({ file: filename, error: 'Invalid frontmatter' });
        continue;
      }
      
      const fmText = fmMatch[1];
      const bodyText = fmMatch[2];
      
      // Parse YAML frontmatter (simple)
      const frontmatter = {};
      for (const line of fmText.split('\n')) {
        const match = line.match(/^([\w_]+):\s*(.+)$/);
        if (match) {
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith('[') && val.endsWith(']')) {
            try { val = JSON.parse(val); } catch {}
          }
          frontmatter[match[1]] = val;
        }
      }
      
      // Fetch full article
      console.log(`  Fetching: ${frontmatter.url?.slice(0, 60)}...`);
      const fullText = await fetchArticleText(frontmatter.url);
      
      if (!fullText) {
        console.warn(`  ✗ Failed to fetch article, keeping pending`);
        errors.push({ file: filename, error: 'Fetch failed' });
        continue;
      }
      
      // Extract key points
      const keyPoints = extractKeyPoints(fullText, frontmatter.tickers || []);
      console.log(`  ✓ Extracted ${keyPoints.length} key points`);
      
      // Generate portfolio impact
      const portfolioImpact = generatePortfolioImpact(
        frontmatter.tickers || [], 
        frontmatter.title, 
        keyPoints
      );
      
      // Build summarized markdown
      const summarizedMd = buildSummarizedMarkdown(
        frontmatter,
        fullText,
        keyPoints,
        portfolioImpact
      );
      
      // Write to news directory
      const newsPath = `${NEWS_DIR}/${filename}`;
      await writeFile(newsPath, summarizedMd);
      console.log(`  ✓ Written: ${newsPath}`);
      
      // Delete pending file
      await unlink(pendingPath);
      console.log(`  ✓ Removed pending: ${filename}`);
      
      processed.push({
        file: filename,
        title: frontmatter.title,
        tickers: frontmatter.tickers,
        keyPoints: keyPoints.length
      });
      
    } catch (e) {
      console.warn(`  ✗ Error processing ${filename}: ${e.message}`);
      errors.push({ file: filename, error: e.message });
    }
  }
  
  console.log(`\n✓ Done: ${processed.length} summarized, ${errors.length} errors`);
  return { processed, errors };
}

// Run if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  summarizePending().then(result => {
    process.exit(result.errors.length > 0 ? 1 : 0);
  });
}

export { summarizePending };
