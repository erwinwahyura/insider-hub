export const prerender = true;

// Secured R2 access - internal use only, no public listing
// Raw scrapes are archived here, articles are the public output
// Access patterns:
// - POST /api/archive-scrape (auth required) - Save raw scrape to R2
// - GET /api/article-from-r2?path=... (internal) - Retrieve processed content
// - No public directory listing
