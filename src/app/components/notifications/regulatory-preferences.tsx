'use client';

import React from 'react';
import { FileText, Info } from 'lucide-react';

interface RegulatoryPreferencesProps {
  includeRegulationChanges: boolean;
  onChange: (include: boolean) => void;
}

const RegulatoryPreferences: React.FC<RegulatoryPreferencesProps> = ({
  includeRegulationChanges,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-medium text-rc-ink">Regulatory Notifications</h3>
        <p className="text-xs text-rc-ink-mute mt-1">
          Get notified about fishing regulation changes in your area
        </p>
      </div>

      {/* Main toggle */}
      <label className="flex items-center justify-between p-4 bg-rc-surface rounded-lg cursor-pointer hover:bg-rc-brand-soft transition-colors border border-rc-rule">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rc-brand-soft rounded-lg">
            <FileText className="w-5 h-5 text-rc-brand" />
          </div>
          <div>
            <div className="text-sm font-medium text-rc-ink">
              Include Regulation Changes
            </div>
            <div className="text-xs text-rc-ink-mute mt-0.5">
              Receive updates about limit changes, closures, and new regulations
            </div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={includeRegulationChanges}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded text-rc-brand border-rc-rule focus:ring-2 focus:ring-rc-brand/30"
        />
      </label>

      {/* Info box */}
      <div className="flex gap-3 p-3 bg-rc-brand-soft border border-rc-brand-soft2 rounded-lg">
        <Info className="w-5 h-5 text-rc-brand flex-shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p className="text-xs text-rc-brand font-medium">
            How Regulatory Notifications Work
          </p>
          <ul className="text-xs text-rc-ink-soft space-y-1 list-disc list-inside">
            <li>
              Regulation changes are <strong className="text-rc-ink">bundled with your scheduled notifications</strong>
            </li>
            <li>
              Updates include: size/bag limit changes, gear restrictions, closures, and effective dates
            </li>
            <li>
              Covers DFO Area 19 (Victoria, Sidney) and Area 20 (Sooke, Port Renfrew)
            </li>
            <li>
              Regulations are checked daily and changes are detected automatically
            </li>
          </ul>
        </div>
      </div>

      {/* Examples of what's tracked */}
      {includeRegulationChanges && (
        <div className="p-4 bg-rc-surface border border-rc-rule rounded-lg">
          <h4 className="text-xs font-medium text-rc-ink mb-3">You&apos;ll be notified about:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Daily limit changes</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Annual limit changes</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Size restrictions (min/max)</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Gear restrictions</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Season openings/closures</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-rc-ink-soft">
              <span className="text-rc-good">✓</span>
              <span>Status changes (Open/Closed)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulatoryPreferences;
