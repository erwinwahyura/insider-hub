-- Insider Hub Database Schema
-- Multi-user portfolio system

-- Enable RLS (Row Level Security)
alter default privileges in schema public grant all on tables to anon, authenticated;

-- Portfolios table
CREATE TABLE portfolios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  name VARCHAR(100),
  sector VARCHAR(50),
  lots INTEGER NOT NULL,
  avg_price DECIMAL(12,2) NOT NULL,
  conviction VARCHAR(20) DEFAULT 'HOLD', -- HIGH, CORE, HOLD, SPEC
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on portfolios
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own portfolios
CREATE POLICY "Users can only view own portfolios"
  ON portfolios FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can only insert their own portfolios
CREATE POLICY "Users can only insert own portfolios"
  ON portfolios FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only update their own portfolios
CREATE POLICY "Users can only update own portfolios"
  ON portfolios FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can only delete their own portfolios
CREATE POLICY "Users can only delete own portfolios"
  ON portfolios FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Watchlist table (stocks to watch, not necessarily owned)
CREATE TABLE watchlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  name VARCHAR(100),
  target_entry DECIMAL(12,2),
  target_exit DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on watchlist
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view own watchlist"
  ON watchlist FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only insert own watchlist"
  ON watchlist FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own watchlist"
  ON watchlist FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only delete own watchlist"
  ON watchlist FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Price alerts table
CREATE TABLE price_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  alert_type VARCHAR(20) NOT NULL, -- price_below, price_above, pnl_threshold
  target_price DECIMAL(12,2) NOT NULL,
  current_price DECIMAL(12,2),
  message TEXT,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  cooldown_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on price_alerts
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view own alerts"
  ON price_alerts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only insert own alerts"
  ON price_alerts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own alerts"
  ON price_alerts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only delete own alerts"
  ON price_alerts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- User preferences table
CREATE TABLE user_preferences (
  user_id uuid PRIMARY KEY,
  currency VARCHAR(3) DEFAULT 'IDR',
  timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
  email_alerts BOOLEAN DEFAULT false,
  push_alerts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can only update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Create unique constraint for user_id + ticker in portfolios
CREATE UNIQUE INDEX idx_portfolios_user_ticker ON portfolios(user_id, ticker);

-- Create unique constraint for user_id + ticker in watchlist
CREATE UNIQUE INDEX idx_watchlist_user_ticker ON watchlist(user_id, ticker);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on portfolios
CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default data for first user (Hiru)
-- Note: user_id should be replaced with actual Clerk user ID after signup
INSERT INTO portfolios (user_id, ticker, name, sector, lots, avg_price, conviction, notes)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'PTPS', 'PT Pulau Subur Tbk', 'CPO/Plantation', 1560, 191, 'HIGH', 'B50 biodiesel thesis + PKS expansion'),
  ('00000000-0000-0000-0000-000000000001', 'PGEO', 'Pertamina Geothermal Energy', 'Geothermal/Energy', 245, 1010, 'CORE', 'USD revenue, Danantara partnership'),
  ('00000000-0000-0000-0000-000000000001', 'ESSA', 'Surya Esa Perkasa Tbk', 'Ammonia/Chemical', 310, 713, 'HOLD', 'Qatar force majeure beneficiary');

INSERT INTO price_alerts (user_id, ticker, alert_type, target_price, current_price, message, priority, cooldown_minutes)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'PTPS', 'price_below', 175, 183, '🟢 PTPS buy opportunity: Price dropped to {price} (target: {target}). Consider adding to position.', 'high', 60),
  ('00000000-0000-0000-0000-000000000001', 'PTPS', 'price_below', 150, 183, '🔴 PTPS alert: Price fell to {price} (below {target}). Review thesis - potential stop loss zone.', 'critical', 30),
  ('00000000-0000-0000-0000-000000000001', 'PGEO', 'price_below', 950, 1020, '🟢 PGEO add opportunity: Price at {price} (target zone: <{target}). Staged entry tranche.', 'medium', 120),
  ('00000000-0000-0000-0000-000000000001', 'PGEO', 'price_above', 1100, 1020, '📈 PGEO breakout: Price broke {target} at {price}. Momentum building toward analyst target 1,662.', 'medium', 60),
  ('00000000-0000-0000-0000-000000000001', 'ESSA', 'price_above', 750, 720, '📈 ESSA recovery: Price back to {price} (above {target}). Q1 2026 catalyst approaching.', 'medium', 60);
