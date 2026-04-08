// D1 Database client for Cloudflare Workers
// Used in Astro SSR mode with Cloudflare adapter

import type { D1Database } from '@cloudflare/workers-types';

export interface Portfolio {
  id: number;
  user_id: string;
  ticker: string;
  name: string;
  sector: string;
  lots: number;
  avg_price: number;
  conviction: 'HIGH' | 'CORE' | 'HOLD' | 'SPEC';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PriceAlert {
  id: number;
  user_id: string;
  ticker: string;
  alert_type: 'price_below' | 'price_above' | 'pnl_threshold';
  target_price: number;
  current_price?: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldown_minutes: number;
  is_active: boolean;
  last_triggered?: string;
  created_at: string;
}

// Get D1 database from environment
export function getDB(env: Record<string, unknown>): D1Database | null {
  return (env.DB as D1Database) || null;
}

// Portfolio CRUD operations
export async function getUserPortfolios(db: D1Database, userId: string): Promise<Portfolio[]> {
  const { results } = await db
    .prepare('SELECT * FROM portfolios WHERE user_id = ? ORDER BY ticker')
    .bind(userId)
    .all<Portfolio>();
  return results || [];
}

export async function addPortfolio(
  db: D1Database,
  userId: string,
  data: Omit<Portfolio, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare(
        `INSERT INTO portfolios (user_id, ticker, name, sector, lots, avg_price, conviction, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(userId, data.ticker, data.name, data.sector, data.lots, data.avg_price, data.conviction, data.notes || null)
      .run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}

export async function updatePortfolio(
  db: D1Database,
  userId: string,
  id: number,
  data: Partial<Pick<Portfolio, 'lots' | 'avg_price' | 'conviction' | 'notes'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.lots !== undefined) {
      updates.push('lots = ?');
      values.push(data.lots);
    }
    if (data.avg_price !== undefined) {
      updates.push('avg_price = ?');
      values.push(data.avg_price);
    }
    if (data.conviction !== undefined) {
      updates.push('conviction = ?');
      values.push(data.conviction);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }
    
    if (updates.length === 0) return { success: true };
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId, id);
    
    await db
      .prepare(`UPDATE portfolios SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`)
      .bind(...values)
      .run();
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}

export async function deletePortfolio(
  db: D1Database,
  userId: string,
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare('DELETE FROM portfolios WHERE user_id = ? AND id = ?')
      .bind(userId, id)
      .run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}

// Alerts CRUD operations
export async function getUserAlerts(db: D1Database, userId: string): Promise<PriceAlert[]> {
  const { results } = await db
    .prepare('SELECT * FROM price_alerts WHERE user_id = ? ORDER BY priority DESC, created_at DESC')
    .bind(userId)
    .all<PriceAlert>();
  return results || [];
}

export async function addAlert(
  db: D1Database,
  userId: string,
  data: Omit<PriceAlert, 'id' | 'user_id' | 'created_at'>
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare(
        `INSERT INTO price_alerts (user_id, ticker, alert_type, target_price, current_price, message, priority, cooldown_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        userId,
        data.ticker,
        data.alert_type,
        data.target_price,
        data.current_price || null,
        data.message,
        data.priority,
        data.cooldown_minutes,
        data.is_active ? 1 : 0
      )
      .run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}

export async function updateAlert(
  db: D1Database,
  userId: string,
  id: number,
  data: Partial<Pick<PriceAlert, 'current_price' | 'is_active' | 'last_triggered'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    
    if (data.current_price !== undefined) {
      updates.push('current_price = ?');
      values.push(data.current_price);
    }
    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.last_triggered !== undefined) {
      updates.push('last_triggered = ?');
      values.push(data.last_triggered);
    }
    
    if (updates.length === 0) return { success: true };
    
    values.push(userId, id);
    
    await db
      .prepare(`UPDATE price_alerts SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`)
      .bind(...values)
      .run();
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}

export async function deleteAlert(
  db: D1Database,
  userId: string,
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare('DELETE FROM price_alerts WHERE user_id = ? AND id = ?')
      .bind(userId, id)
      .run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Database error' };
  }
}
