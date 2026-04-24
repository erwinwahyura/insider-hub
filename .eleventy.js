/**
 * Insider Hub — Eleventy (11ty) Configuration
 * Simple, no-nonsense static site generator
 */

const matter = require('gray-matter');
const fs = require('fs');
const path = require('path');

module.exports = function(eleventyConfig) {
  // Passthrough static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("public");
  eleventyConfig.addPassthroughCopy({
    "src/content/data": "data"
  });
  
  // Read JSON data files
  eleventyConfig.addDataExtension("json", contents => JSON.parse(contents));
  
  // Global data: stocks
  eleventyConfig.addGlobalData("stocks", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/stock-prices.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { stocks: {}, portfolio: {} };
    }
  });
  
  // Global data: commodities
  eleventyConfig.addGlobalData("commodities", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/commodities.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { commodities: {} };
    }
  });
  
  // Global data: alerts
  eleventyConfig.addGlobalData("alerts", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/alerts.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { alerts: [] };
    }
  });
  
  // Global data: portfolio history
  eleventyConfig.addGlobalData("portfolioHistory", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/portfolio-history.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { snapshots: [], metadata: {} };
    }
  });
  
  // Global data: foreign flow
  eleventyConfig.addGlobalData("foreignFlow", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/foreign-flow.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { summary: { topBuyers: [], topSellers: [], netFlow: 0 }, tickers: {} };
    }
  });
  
  // Global data: block trades
  eleventyConfig.addGlobalData("blockTrades", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/block-trades.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { trades: [], count: 0, totalBlockValue: 0 };
    }
  });
  
  // Global data: smart money
  eleventyConfig.addGlobalData("smartMoney", () => {
    try {
      const raw = fs.readFileSync('./src/content/data/smart-money.json', 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      return { summary: { accumulationCount: 0, distributionCount: 0, topSignals: [] }, tickers: {} };
    }
  });
  
  // Read all news articles
  eleventyConfig.addGlobalData("news", () => {
    const newsDir = './src/content/news';
    if (!fs.existsSync(newsDir)) return [];
    
    const files = fs.readdirSync(newsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const raw = fs.readFileSync(path.join(newsDir, f), 'utf-8');
        const parsed = matter(raw);
        return {
          id: f.replace('.md', ''),
          ...parsed.data,
          content: parsed.content
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return files;
  });
  
  // Filters
  eleventyConfig.addFilter("dateFormat", (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMins = Math.floor((now - d) / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  
  eleventyConfig.addFilter("formatRp", (n) => {
    if (!n) return 'Rp 0';
    if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `Rp ${(n / 1000).toFixed(1)}K`;
    return `Rp ${n.toLocaleString()}`;
  });
  
  eleventyConfig.addFilter("json", (obj) => JSON.stringify(obj, null, 2));
  
  // Array min/max helpers
  eleventyConfig.addFilter("min", (arr, key) => {
    if (!arr || arr.length === 0) return 0;
    return Math.min(...arr.map(item => item[key] || 0));
  });
  
  eleventyConfig.addFilter("max", (arr, key) => {
    if (!arr || arr.length === 0) return 0;
    return Math.max(...arr.map(item => item[key] || 0));
  });
  
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["html", "njk", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
