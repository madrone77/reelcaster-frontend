'use client';

import React from 'react';
import { Fish, Check } from 'lucide-react';

// Centralized species config
import { FISH_SPECIES } from '@/app/config/species';

interface SpeciesSelectorProps {
  selectedSpecies: string[];
  onChange: (species: string[]) => void;
}

// Use centralized config (excludes shellfish for notification purposes)
const SPECIES_OPTIONS = FISH_SPECIES.filter(s => s.category !== 'shellfish');

const SpeciesSelector: React.FC<SpeciesSelectorProps> = ({ selectedSpecies, onChange }) => {
  const handleToggle = (speciesId: string) => {
    if (selectedSpecies.includes(speciesId)) {
      onChange(selectedSpecies.filter((id) => id !== speciesId));
    } else {
      onChange([...selectedSpecies, speciesId]);
    }
  };

  const handleSelectAll = () => {
    onChange(SPECIES_OPTIONS.map((species) => species.id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const isAllSelected = selectedSpecies.length === SPECIES_OPTIONS.length;

  return (
    <div className="space-y-4">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-rc-ink">Favorite Species</h3>
          <p className="text-xs text-rc-ink-mute mt-1">
            Select species you want to track for notifications
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            disabled={isAllSelected}
            className="text-xs px-3 py-1 rounded-md border border-rc-rule text-rc-ink-soft hover:bg-rc-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Select All
          </button>
          <button
            onClick={handleClearAll}
            disabled={selectedSpecies.length === 0}
            className="text-xs px-3 py-1 rounded-md border border-rc-rule text-rc-ink-soft hover:bg-rc-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Species selection counter */}
      <div className="text-xs text-rc-brand bg-rc-brand-soft px-3 py-2 rounded-md border border-rc-brand-soft2">
        {selectedSpecies.length} of {SPECIES_OPTIONS.length} species selected
      </div>

      {/* Species grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SPECIES_OPTIONS.map((species) => {
          const isSelected = selectedSpecies.includes(species.id);

          return (
            <button
              key={species.id}
              onClick={() => handleToggle(species.id)}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${
                  isSelected
                    ? 'border-rc-brand bg-rc-brand-soft'
                    : 'border-rc-rule bg-rc-surface hover:border-rc-ink-mute hover:bg-rc-panel'
                }
              `}
            >
              {/* Checkmark indicator */}
              <div
                className={`
                absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${isSelected ? 'border-rc-brand bg-rc-brand' : 'border-rc-rule bg-rc-panel'}
              `}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              {/* Species icon */}
              <div className="flex items-start gap-3">
                <div
                  className={`
                  p-2 rounded-lg
                  ${isSelected ? 'bg-rc-brand-soft2' : 'bg-rc-panel'}
                `}
                >
                  <Fish className={`w-5 h-5 ${isSelected ? 'text-rc-brand' : 'text-rc-ink-mute'}`} />
                </div>

                <div className="flex-1 pr-6">
                  <h4
                    className={`text-sm font-semibold ${
                      isSelected ? 'text-rc-brand' : 'text-rc-ink'
                    }`}
                  >
                    {species.name}
                  </h4>
                  <p className="text-xs text-rc-ink-mute italic mt-0.5">{species.scientificName}</p>
                  <p className="text-xs text-rc-ink-mute mt-1">{species.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Help text */}
      {selectedSpecies.length === 0 && (
        <div className="text-center p-4 bg-rc-fair-bg border border-rc-fair-border rounded-lg">
          <p className="text-sm text-rc-fair-ink">
            Select at least one species to receive personalized fishing notifications
          </p>
        </div>
      )}
    </div>
  );
};

export default SpeciesSelector;
