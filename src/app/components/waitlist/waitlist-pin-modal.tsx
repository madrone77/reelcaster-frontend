'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';

const WaitlistPinMap = dynamic(() => import('./waitlist-pin-map'), { ssr: false });

export type WaitlistPinSource = 'anon_pin' | 'plus_upgrade_attempt' | 'tier3_alert_attempt';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Where the modal was opened from — used for funnel attribution. */
  source: WaitlistPinSource;
  /** Optional pre-filled species text (used by search empty state). */
  initialSpecies?: string;
  /** Optional pre-filled coordinates (used by /pricing 'Other' or /my-spots uncovered). */
  initialLat?: number;
  initialLon?: number;
  /** Override the heading copy. */
  title?: string;
  description?: string;
}

export default function WaitlistPinModal({
  open,
  onClose,
  source,
  initialSpecies,
  initialLat,
  initialLon,
  title = "Help us pick where to expand next",
  description = "Drop a pin where you'd like ReelCaster to cover. We'll email you the moment it's live.",
}: Props) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState('');
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(
    initialLat !== undefined && initialLon !== undefined
      ? { lat: initialLat, lon: initialLon }
      : null,
  );
  const [species, setSpecies] = useState<string>(initialSpecies ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user?.email) setEmail(user.email);
  }, [open, user?.email]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin) {
      setError('Drop a pin on the map first.');
      return;
    }

    setSubmitting(true);
    try {
      const speciesArr = species
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/waitlist-pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          lat: pin.lat,
          lon: pin.lon,
          species: speciesArr,
          source,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save pin');
      }

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save pin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-rc-bg-dark border border-rc-bg-light rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between p-5 border-b border-rc-bg-light">
          <div>
            <h2 className="text-lg font-semibold text-rc-text">{title}</h2>
            <p className="text-sm text-rc-text-muted mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-rc-text-muted hover:text-rc-text"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Map */}
          <div>
            <Label className="text-rc-text mb-2 block">Pin location</Label>
            <div className="h-[260px] rounded-lg overflow-hidden border border-rc-bg-light relative">
              <WaitlistPinMap
                initialLat={initialLat}
                initialLon={initialLon}
                onChange={setPin}
              />
            </div>
            {pin && (
              <p className="text-xs text-rc-text-muted mt-2 font-mono">
                {pin.lat.toFixed(4)}, {pin.lon.toFixed(4)}
              </p>
            )}
          </div>

          {/* Species */}
          <div>
            <Label htmlFor="species" className="text-rc-text">
              Target species{' '}
              <span className="text-rc-text-muted text-xs font-normal">
                (optional, comma-separated)
              </span>
            </Label>
            <Input
              id="species"
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. tarpon, snook"
              className="mt-1"
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="waitlist-email" className="text-rc-text">
              Email
            </Label>
            <Input
              id="waitlist-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="mt-1"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-md p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 border-rc-bg-light text-rc-text-muted hover:bg-rc-bg-light"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || saved || !pin}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-1" /> Saved!
                </>
              ) : submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…
                </>
              ) : (
                'Add to waitlist'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
