// Portfolio API - returns user's positions
export async function onRequestGet(context) {
  const user = context.data.user;
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const db = context.env.DB;
  
  // Get user's positions
  const { results } = await db.prepare(
    'SELECT ticker, lots, avg_price, sector, notes FROM portfolio_positions WHERE user_id = ?'
  ).bind(user.id).all();
  
  // Calculate totals
  let totalInvested = 0;
  let totalMarketValue = 0;
  
  const positions = results || [];
  
  // Get current prices from stock-prices.json (stored in KV or fetch)
  // For now, return positions only
  
  return new Response(JSON.stringify({
    user: user.email,
    positions: positions,
    totalPositions: positions.length
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Update portfolio position
export async function onRequestPost(context) {
  const user = context.data.user;
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { ticker, lots, avg_price, sector, notes } = await context.request.json();
  
  if (!ticker || !lots || !avg_price) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const db = context.env.DB;
  
  // Upsert position
  await db.prepare(`
    INSERT INTO portfolio_positions (user_id, ticker, lots, avg_price, sector, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, ticker) DO UPDATE SET
      lots = excluded.lots,
      avg_price = excluded.avg_price,
      sector = excluded.sector,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).bind(user.id, ticker, lots, avg_price, sector || null, notes || null).run();
  
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
