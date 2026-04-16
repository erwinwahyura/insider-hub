-- Seed portfolio positions for admin user
-- Run after 0001_init.sql

INSERT OR REPLACE INTO portfolio_positions (user_id, ticker, lots, avg_price, sector, notes, updated_at)
VALUES 
  (1, 'PTPS', 2832, 190.17, 'CPO/Plantation', 'B50 biodiesel play', CURRENT_TIMESTAMP),
  (1, 'PGEO', 370, 1036.34, 'Geothermal/Energy', 'Pertamina geothermal', CURRENT_TIMESTAMP),
  (1, 'ESSA', 445, 791.18, 'Ammonia/Chemical', 'Fertilizer cycle', CURRENT_TIMESTAMP),
  (1, 'ITMG', 1, 28167, 'Coal', 'Coal position', CURRENT_TIMESTAMP);

-- Verify seed
SELECT 'SEEDED' as status, ticker, lots, avg_price FROM portfolio_positions WHERE user_id = 1;
