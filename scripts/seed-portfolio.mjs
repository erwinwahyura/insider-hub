#!/usr/bin/env node
/**
 * Seed portfolio positions into D1 database
 * Usage: node scripts/seed-portfolio.mjs
 */

// Your actual positions from Stockbit
const PORTFOLIO_SEED = [
  { ticker: 'PTPS', lots: 2832, avg_price: 190.17, sector: 'CPO/Plantation', notes: 'B50 biodiesel play' },
  { ticker: 'PGEO', lots: 370, avg_price: 1036.34, sector: 'Geothermal/Energy', notes: 'Pertamina geothermal' },
  { ticker: 'ESSA', lots: 445, avg_price: 791.18, sector: 'Ammonia/Chemical', notes: 'Fertilizer cycle' },
  { ticker: 'ITMG', lots: 1, avg_price: 28167, sector: 'Coal', notes: 'Coal position' },
];

async function seed() {
  console.log('🌱 Seeding portfolio positions...\n');
  
  // Generate SQL for seeding
  const sql = `
-- Seed portfolio positions for user ID 1 (admin@localhost)
${PORTFOLIO_SEED.map(p => `
INSERT OR REPLACE INTO portfolio_positions (user_id, ticker, lots, avg_price, sector, notes, updated_at)
VALUES (1, '${p.ticker}', ${p.lots}, ${p.avg_price}, '${p.sector}', '${p.notes}', CURRENT_TIMESTAMP);
`).join('\n')}

-- Verify
SELECT ticker, lots, avg_price, sector FROM portfolio_positions WHERE user_id = 1;
`;
  
  console.log('Generated SQL:');
  console.log('='.repeat(50));
  console.log(sql);
  console.log('='.repeat(50));
  console.log('\n📋 To apply this seed:');
  console.log('1. Save the SQL above to seed.sql');
  console.log('2. Run: wrangler d1 execute insider-hub-db --file=seed.sql');
  console.log('\nOr manually insert via wrangler d1 execute with --command');
  
  // Also write to file for easy use
  const fs = await import('fs/promises');
  await fs.writeFile('./seed.sql', sql);
  console.log('\n✅ Saved to seed.sql');
  
  // Calculate totals
  const totalInvested = PORTFOLIO_SEED.reduce((sum, p) => sum + (p.lots * p.avg_price * 100), 0);
  console.log(`\n💰 Total invested: Rp ${(totalInvested/1000000).toFixed(1)}M`);
  console.log(`📊 Positions: ${PORTFOLIO_SEED.length}`);
}

seed().catch(console.error);
