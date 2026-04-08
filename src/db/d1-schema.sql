-- Insider Hub Database Schema for Cloudflare D1 (SQLite)
-- Multi-user portfolio system

-- Portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT,
  sector TEXT,
  lots INTEGER NOT NULL,
  avg_price REAL NOT NULL,
  conviction TEXT DEFAULT 'HOLD',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ticker)
);

-- Watchlist table (stocks to watch)
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT,
  target_entry REAL,
  target_exit REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ticker)
);

-- Price alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  target_price REAL NOT NULL,
  current_price REAL,
  message TEXT,
  priority TEXT DEFAULT 'medium',
  cooldown_minutes INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  last_triggered DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  currency TEXT DEFAULT 'IDR',
  timezone TEXT DEFAULT 'Asia/Jakarta',
  email_alerts INTEGER DEFAULT 0,
  push_alerts INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);

-- Insert default data for Hiru (placeholder user_id - update with real Clerk ID)
INSERT OR IGNORE INTO portfolios (user_id, ticker, name, sector, lots, avg_price, conviction, notes)
VALUES 
  ('hiru-placeholder', 'PTPS', 'PT Pulau Subur Tbk', 'CPO/Plantation', 1560, 191, 'HIGH', 'B50 biodiesel thesis + PKS expansion'),
  ('hiru-placeholder', 'PGEO', 'Pertamina Geothermal Energy', 'Geothermal/Energy', 245, 1010, 'CORE', 'USD revenue, Danantara partnership'),
  ('hiru-placeholder', 'ESSA', 'Surya Esa Perkasa Tbk', 'Ammonia/Chemical', 310, 713, 'HOLD', 'Qatar force majeure beneficiary');

INSERT OR IGNORE INTO price_alerts (user_id, ticker, alert_type, target_price, current_price, message, priority, cooldown_minutes)
VALUES
  ('hiru-placeholder', 'PTPS', 'price_below', 175, 183, 'PTPS buy opportunity: Price dropped to {price} (target: {target})', 'high', 60),
  ('hiru-placeholder', 'PTPS', 'price_below', 150, 183, 'PTPS alert: Price fell to {price} (below {target})', 'critical', 30),
  ('hiru-placeholder', 'PGEO', 'price_below', 950, 1020, 'PGEO add opportunity: Price at {price} (target zone: <{target})', 'medium', 120),
  ('hiru-placeholder', 'PGEO', 'price_above', 1100, 1020, 'PGEO breakout: Price broke {target} at {price}', 'medium', 60),
  ('hiru-placeholder', 'ESSA', 'price_above', 750, 720, 'ESSA recovery: Price back to {price} (above {target})', 'medium', 60);
