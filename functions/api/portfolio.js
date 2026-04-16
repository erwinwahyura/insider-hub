// Portfolio API - returns user's positions from existing 'portfolios' table
export async function onRequestGet(context) {
  const user = context.data.user;
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const db = context.env.DB;
  
  // Get user's positions from existing 'portfolios' table
  // Assuming portfolios has: user_id, ticker, lots, avg_price, etc.
  try {
    const { results } = await db.prepare(
      'SELECT ticker, lots, avg_price, sector, notes FROM portfolios WHERE user_id = ?'
    ).bind(user.id).all();
    
    const positions = results || [];
    
    return new Response(JSON.stringify({
      user: user.email,
      positions: positions,
      totalPositions: positions.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    // If table structure is different, return error
    return new Response(JSON.stringify({ 
      error: 'Database error', 
      message: e.message,
      hint: 'Check portfolios table schema'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
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
  
  try {
    // Try to upsert - adjust column names based on your actual schema
    await db.prepare(`
      INSERT INTO portfolios (user_id, ticker, lots, avg_price, sector, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
  } catch (e) {
    return new Response(JSON.stringify({ 
      error: 'Database error', 
      message: e.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
