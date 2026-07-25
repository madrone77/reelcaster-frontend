'use client';

import React from 'react';
import {
  Wind,
  Waves,
  CloudRain,
  Thermometer,
  Target,
  Sun,
  CloudLightning,
  AlertTriangle,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/user-preferences';

interface WeatherThreshold {
  wind_speed_threshold_kph: number;
  wave_height_threshold_m: number;
  precipitation_threshold_mm: number;
  temperature_min_c: number;
  temperature_max_c: number;
  fishing_score_threshold: number;
  uv_index_threshold: number;
  alert_on_thunderstorm: boolean;
  alert_on_gale_warning: boolean;
  alert_on_pressure_drop: boolean;
}

interface WeatherThresholdSlidersProps {
  thresholds: WeatherThreshold;
  onChange: (thresholds: WeatherThreshold) => void;
}

const WeatherThresholdSliders: React.FC<WeatherThresholdSlidersProps> = ({
  thresholds,
  onChange,
}) => {
  const handleChange = (field: keyof WeatherThreshold, value: number | boolean) => {
    onChange({
      ...thresholds,
      [field]: value,
    });
  };

  const handleReset = () => {
    onChange({
      wind_speed_threshold_kph: DEFAULT_NOTIFICATION_PREFERENCES.wind_speed_threshold_kph,
      wave_height_threshold_m: DEFAULT_NOTIFICATION_PREFERENCES.wave_height_threshold_m,
      precipitation_threshold_mm: DEFAULT_NOTIFICATION_PREFERENCES.precipitation_threshold_mm,
      temperature_min_c: DEFAULT_NOTIFICATION_PREFERENCES.temperature_min_c,
      temperature_max_c: DEFAULT_NOTIFICATION_PREFERENCES.temperature_max_c,
      fishing_score_threshold: DEFAULT_NOTIFICATION_PREFERENCES.fishing_score_threshold,
      uv_index_threshold: DEFAULT_NOTIFICATION_PREFERENCES.uv_index_threshold,
      alert_on_thunderstorm: DEFAULT_NOTIFICATION_PREFERENCES.alert_on_thunderstorm,
      alert_on_gale_warning: DEFAULT_NOTIFICATION_PREFERENCES.alert_on_gale_warning,
      alert_on_pressure_drop: DEFAULT_NOTIFICATION_PREFERENCES.alert_on_pressure_drop,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-rc-ink">Weather Thresholds</h3>
          <p className="text-xs text-rc-ink-mute mt-0.5">
            Set your preferred conditions for notifications
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-rc-rule text-rc-ink-soft hover:bg-rc-surface transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      </div>

      {/* Fishing Score Threshold - Featured */}
      <div className="p-3 bg-rc-surface border border-rc-rule rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-rc-brand" />
            <label className="text-sm font-medium text-rc-ink">Fishing Score</label>
          </div>
          <span className="text-base font-bold text-rc-brand">
            {thresholds.fishing_score_threshold}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={thresholds.fishing_score_threshold}
          onChange={(e) => handleChange('fishing_score_threshold', Number(e.target.value))}
          className="w-full h-1.5 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
        />
        <div className="flex justify-between text-[10px] text-rc-ink-mute mt-1">
          <span>Poor</span>
          <span>Fair</span>
          <span>Excellent</span>
        </div>
      </div>

      {/* Weather Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Wind Speed */}
        <div className="p-2.5 bg-rc-surface border border-rc-rule rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-rc-ink-mute" />
              <label className="text-xs font-medium text-rc-ink">Wind</label>
            </div>
            <span className="text-xs font-semibold text-rc-ink-soft">
              {thresholds.wind_speed_threshold_kph}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={thresholds.wind_speed_threshold_kph}
            onChange={(e) => handleChange('wind_speed_threshold_kph', Number(e.target.value))}
            className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
          />
          <div className="flex justify-between text-[10px] text-rc-ink-mute mt-1">
            <span>0</span>
            <span>60 km/h</span>
          </div>
        </div>

        {/* Wave Height */}
        <div className="p-2.5 bg-rc-surface border border-rc-rule rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-rc-ink-mute" />
              <label className="text-xs font-medium text-rc-ink">Waves</label>
            </div>
            <span className="text-xs font-semibold text-rc-ink-soft">
              {thresholds.wave_height_threshold_m.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={thresholds.wave_height_threshold_m}
            onChange={(e) => handleChange('wave_height_threshold_m', Number(e.target.value))}
            className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
          />
          <div className="flex justify-between text-[10px] text-rc-ink-mute mt-1">
            <span>0</span>
            <span>5 m</span>
          </div>
        </div>

        {/* Precipitation */}
        <div className="p-2.5 bg-rc-surface border border-rc-rule rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-rc-ink-mute" />
              <label className="text-xs font-medium text-rc-ink">Rain</label>
            </div>
            <span className="text-xs font-semibold text-rc-ink-soft">
              {thresholds.precipitation_threshold_mm.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={thresholds.precipitation_threshold_mm}
            onChange={(e) => handleChange('precipitation_threshold_mm', Number(e.target.value))}
            className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
          />
          <div className="flex justify-between text-[10px] text-rc-ink-mute mt-1">
            <span>0</span>
            <span>20 mm</span>
          </div>
        </div>

        {/* UV Index */}
        <div className="p-2.5 bg-rc-surface border border-rc-rule rounded-lg">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-rc-ink-mute" />
              <label className="text-xs font-medium text-rc-ink">UV Index</label>
            </div>
            <span className="text-xs font-semibold text-rc-ink-soft">
              {thresholds.uv_index_threshold}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={11}
            step={1}
            value={thresholds.uv_index_threshold}
            onChange={(e) => handleChange('uv_index_threshold', Number(e.target.value))}
            className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
          />
          <div className="flex justify-between text-[10px] text-rc-ink-mute mt-1">
            <span>0</span>
            <span>11+</span>
          </div>
        </div>
      </div>

      {/* Temperature Range - Full Width */}
      <div className="p-3 bg-rc-surface border border-rc-rule rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-rc-ink-mute" />
            <label className="text-sm font-medium text-rc-ink">Temperature Range</label>
          </div>
          <span className="text-xs font-semibold text-rc-ink-soft">
            {thresholds.temperature_min_c}°C to {thresholds.temperature_max_c}°C
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Min Temperature */}
          <div>
            <label className="text-[10px] font-medium text-rc-ink-mute mb-1 block">Min</label>
            <input
              type="range"
              min={-5}
              max={35}
              step={1}
              value={thresholds.temperature_min_c}
              onChange={(e) => handleChange('temperature_min_c', Number(e.target.value))}
              className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
            />
          </div>

          {/* Max Temperature */}
          <div>
            <label className="text-[10px] font-medium text-rc-ink-mute mb-1 block">Max</label>
            <input
              type="range"
              min={-5}
              max={35}
              step={1}
              value={thresholds.temperature_max_c}
              onChange={(e) => handleChange('temperature_max_c', Number(e.target.value))}
              className="w-full h-1 bg-rc-rule rounded-lg appearance-none cursor-pointer accent-rc-brand"
            />
          </div>
        </div>
      </div>

      {/* Safety Alert Toggles - Compact */}
      <div className="p-3 bg-rc-surface border border-rc-rule rounded-lg">
        <h4 className="text-xs font-medium text-rc-ink mb-2">Safety Alerts</h4>
        <div className="grid grid-cols-3 gap-2">
          {/* Thunderstorm Alert */}
          <label className="flex items-center gap-1.5 p-2 bg-rc-panel rounded cursor-pointer hover:bg-rc-brand-soft transition-colors border border-rc-rule">
            <input
              type="checkbox"
              checked={thresholds.alert_on_thunderstorm}
              onChange={(e) => handleChange('alert_on_thunderstorm', e.target.checked)}
              className="w-3.5 h-3.5 rounded text-rc-brand border-rc-rule"
            />
            <CloudLightning className="w-3.5 h-3.5 text-rc-fair flex-shrink-0" />
            <span className="text-[11px] font-medium text-rc-ink-soft">Storm</span>
          </label>

          {/* Gale Warning Alert */}
          <label className="flex items-center gap-1.5 p-2 bg-rc-panel rounded cursor-pointer hover:bg-rc-brand-soft transition-colors border border-rc-rule">
            <input
              type="checkbox"
              checked={thresholds.alert_on_gale_warning}
              onChange={(e) => handleChange('alert_on_gale_warning', e.target.checked)}
              className="w-3.5 h-3.5 rounded text-rc-brand border-rc-rule"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-rc-fair flex-shrink-0" />
            <span className="text-[11px] font-medium text-rc-ink-soft">Gale</span>
          </label>

          {/* Pressure Drop Alert */}
          <label className="flex items-center gap-1.5 p-2 bg-rc-panel rounded cursor-pointer hover:bg-rc-brand-soft transition-colors border border-rc-rule">
            <input
              type="checkbox"
              checked={thresholds.alert_on_pressure_drop}
              onChange={(e) => handleChange('alert_on_pressure_drop', e.target.checked)}
              className="w-3.5 h-3.5 rounded text-rc-brand border-rc-rule"
            />
            <Gauge className="w-3.5 h-3.5 text-rc-poor flex-shrink-0" />
            <span className="text-[11px] font-medium text-rc-ink-soft">Pressure</span>
          </label>
        </div>
      </div>

      {/* Info box - Compact */}
      <div className="p-2.5 bg-rc-brand-soft border border-rc-brand-soft2 rounded-lg">
        <p className="text-[11px] text-rc-ink-soft">
          <strong className="text-rc-brand">Tip:</strong> Lower thresholds = more notifications. Higher = only ideal conditions.
        </p>
      </div>
    </div>
  );
};

export default WeatherThresholdSliders;
