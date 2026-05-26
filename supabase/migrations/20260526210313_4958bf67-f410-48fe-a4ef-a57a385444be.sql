ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'quoted' BEFORE 'completed';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed' BEFORE 'paid';