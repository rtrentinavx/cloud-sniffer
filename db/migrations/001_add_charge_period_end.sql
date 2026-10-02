ALTER TABLE cost_line_items
  ADD COLUMN IF NOT EXISTS charge_period_end TIMESTAMPTZ;
