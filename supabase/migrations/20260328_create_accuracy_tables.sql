-- Prediction Accuracy Tracking tables (REE-18)
-- Captures predicted scores, historical actuals, algorithm versions, and accuracy comparisons

-- ─── prediction_snapshots ────────────────────────────────────────────────────
-- What the algorithm predicted for each 2-hour block per hotspot
CREATE TABLE prediction_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Location identification
  location_id TEXT NOT NULL,
  hotspot_name TEXT NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,

  -- Time identification
  forecast_date DATE NOT NULL,
  block_start_time TIMESTAMPTZ NOT NULL,
  block_end_time TIMESTAMPTZ NOT NULL,

  -- Algorithm identification
  algorithm_version TEXT NOT NULL DEFAULT 'v1.0',
  species_name TEXT,

  -- Score output
  total_score DECIMAL(4, 2) NOT NULL,
  score_breakdown JSONB NOT NULL,

  -- Weights used
  weights_used JSONB NOT NULL,
  has_chs_data BOOLEAN NOT NULL DEFAULT true,

  -- Input data snapshot
  weather_input JSONB NOT NULL,
  tide_input JSONB,

  -- Metadata
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pred_snap_unique ON prediction_snapshots(
  location_id, hotspot_name, forecast_date, block_start_time, algorithm_version, COALESCE(species_name, '__general__')
);

CREATE INDEX idx_pred_snap_date ON prediction_snapshots(forecast_date DESC);
CREATE INDEX idx_pred_snap_location ON prediction_snapshots(location_id, hotspot_name);
CREATE INDEX idx_pred_snap_version ON prediction_snapshots(algorithm_version);
CREATE INDEX idx_pred_snap_species ON prediction_snapshots(species_name) WHERE species_name IS NOT NULL;
CREATE INDEX idx_pred_snap_lookup ON prediction_snapshots(location_id, hotspot_name, forecast_date, block_start_time);

-- ─── historical_actuals ──────────────────────────────────────────────────────
-- Verified actual conditions fetched retroactively from archive APIs
CREATE TABLE historical_actuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Location identification
  location_id TEXT NOT NULL,
  hotspot_name TEXT NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,

  -- Time
  observation_date DATE NOT NULL,
  observation_hour TIMESTAMPTZ NOT NULL,

  -- Weather actuals (from Open Meteo Archive API)
  temperature_2m DECIMAL(5, 2),
  relative_humidity DECIMAL(5, 2),
  dew_point DECIMAL(5, 2),
  apparent_temperature DECIMAL(5, 2),
  precipitation DECIMAL(6, 3),
  weather_code INTEGER,
  surface_pressure DECIMAL(7, 2),
  cloud_cover DECIMAL(5, 2),
  wind_speed_10m DECIMAL(6, 2),
  wind_direction_10m DECIMAL(5, 2),
  wind_gusts_10m DECIMAL(6, 2),
  visibility DECIMAL(8, 1),
  sunshine_duration DECIMAL(8, 1),

  -- Tide actuals (from CHS IWLS observed data)
  tide_height DECIMAL(5, 3),
  tide_is_rising BOOLEAN,
  tide_change_rate DECIMAL(5, 3),
  current_speed DECIMAL(5, 3),

  -- Computed actual score (algorithm run with actual data)
  computed_score DECIMAL(4, 2),
  computed_breakdown JSONB,

  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  data_sources JSONB,

  UNIQUE(location_id, hotspot_name, observation_hour)
);

CREATE INDEX idx_hist_actual_date ON historical_actuals(observation_date DESC);
CREATE INDEX idx_hist_actual_location ON historical_actuals(location_id, hotspot_name);
CREATE INDEX idx_hist_actual_lookup ON historical_actuals(location_id, hotspot_name, observation_date);

-- ─── algorithm_versions ──────────────────────────────────────────────────────
-- Track algorithm weight/curve configurations for A/B comparison
CREATE TABLE algorithm_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Algorithm definition
  weights_with_chs JSONB NOT NULL,
  weights_without_chs JSONB NOT NULL,
  scoring_curves JSONB,

  -- Metadata
  is_production BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- Seed with current production version
INSERT INTO algorithm_versions (id, name, description, weights_with_chs, weights_without_chs, is_production) VALUES (
  'v1.0',
  'Production Default',
  'Original 18-factor algorithm with default weights and curves',
  '{"pressure":0.11,"pressureTrend":0.08,"wind":0.11,"temperature":0.08,"waterTemperature":0.04,"precipitation":0.09,"tide":0.07,"currentSpeed":0.03,"currentAcceleration":0.04,"currentDirection":0.02,"cloudCover":0.05,"visibility":0.05,"sunshine":0.05,"lightning":0.04,"atmospheric":0.04,"comfort":0.03,"timeOfDay":0.04,"species":0.03}',
  '{"pressure":0.12,"pressureTrend":0.08,"wind":0.12,"temperature":0.10,"waterTemperature":0,"precipitation":0.10,"tide":0.10,"currentSpeed":0,"currentAcceleration":0,"currentDirection":0,"cloudCover":0.05,"visibility":0.05,"sunshine":0.05,"lightning":0.05,"atmospheric":0.04,"comfort":0.04,"timeOfDay":0.04,"species":0.06}',
  true
);

-- ─── accuracy_comparisons ────────────────────────────────────────────────────
-- Pre-computed daily accuracy metrics
CREATE TABLE accuracy_comparisons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Dimensions
  comparison_date DATE NOT NULL,
  location_id TEXT NOT NULL,
  hotspot_name TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  species_name TEXT,

  -- Metrics
  avg_predicted_score DECIMAL(4, 2),
  avg_actual_score DECIMAL(4, 2),
  score_delta DECIMAL(4, 2),
  abs_error DECIMAL(4, 2),

  -- Factor-level errors
  factor_errors JSONB,

  -- Match counts
  blocks_compared INTEGER,
  blocks_within_1pt INTEGER,
  blocks_within_2pt INTEGER,

  -- Catch correlation
  catch_count INTEGER DEFAULT 0,
  landed_count INTEGER DEFAULT 0,
  bite_count INTEGER DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_acc_comp_unique ON accuracy_comparisons(
  comparison_date, location_id, hotspot_name, algorithm_version, COALESCE(species_name, '__general__')
);

CREATE INDEX idx_acc_comp_date ON accuracy_comparisons(comparison_date DESC);
CREATE INDEX idx_acc_comp_location ON accuracy_comparisons(location_id, hotspot_name);
CREATE INDEX idx_acc_comp_version ON accuracy_comparisons(algorithm_version);
CREATE INDEX idx_acc_comp_rolling ON accuracy_comparisons(location_id, comparison_date DESC);

-- ─── RLS Policies ────────────────────────────────────────────────────────────
-- All tables are admin/service-role only

ALTER TABLE prediction_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accuracy_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON prediction_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON historical_actuals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON algorithm_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON accuracy_comparisons FOR ALL TO service_role USING (true) WITH CHECK (true);
