'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import DeliveryChannelPicker from '@/app/components/alerts/delivery-channel-picker';
import ProTrialModal from '@/app/components/paywall/pro-trial-modal';
import type { AlertsSpot } from './alerts-client';

export interface ScoreAlertFormValue {
  spotSlug: string;
  speciesSlug: string | null;
  speciesName: string | null;
  threshold: number;
  cooldownHours: number;
  /** Never empty — the form refuses to submit with no channel selected. */
  channels: ('email' | 'sms')[];
}

interface Props {
  spots: AlertsSpot[];
  onSubmit: (form: ScoreAlertFormValue) => Promise<void> | void;
  onCancel: () => void;
}

interface SpotSpecies {
  slug: string;
  name: string;
  status: string | null;
}

export default function ScoreAlertForm({ spots, onSubmit, onCancel }: Props) {
  const [spotSlug, setSpotSlug] = useState<string>(spots[0]?.slug ?? '');
  const [species, setSpecies] = useState<SpotSpecies[]>([]);
  const [speciesSlug, setSpeciesSlug] = useState<string>('');
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const [cooldownHours, setCooldownHours] = useState(12);
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(false);
  const [smsUpgradeOpen, setSmsUpgradeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, AlertsSpot[]>();
    for (const s of spots) {
      const key = `${s.province_code} · ${s.city_name}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [spots]);

  useEffect(() => {
    if (!spotSlug) return;
    let cancelled = false;
    setSpeciesLoading(true);
    setSpeciesSlug('');
    (async () => {
      try {
        const res = await fetch(`/api/spot-page/${spotSlug}`);
        if (!res.ok) throw new Error('Could not load species');
        const data = await res.json();
        if (cancelled) return;
        const list: SpotSpecies[] = (data.species_table ?? [])
          .filter((s: { status?: string | null }) => s.status === 'open')
          .map((s: { species_slug: string; species_name: string; status: string | null }) => ({
            slug: s.species_slug,
            name: s.species_name,
            status: s.status,
          }));
        setSpecies(list);
      } catch {
        if (!cancelled) setSpecies([]);
      } finally {
        if (!cancelled) setSpeciesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spotSlug]);

  const selectedSpecies = species.find((s) => s.slug === speciesSlug) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!spotSlug) {
      setError('Pick a spot');
      return;
    }
    const channels: ('email' | 'sms')[] = [
      ...(emailOn ? (['email'] as const) : []),
      ...(smsOn ? (['sms'] as const) : []),
    ];
    if (channels.length === 0) {
      setError('Pick at least one way to be notified');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        spotSlug,
        speciesSlug: speciesSlug || null,
        speciesName: selectedSpecies?.name ?? null,
        threshold,
        cooldownHours,
        channels,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-rc-rule shadow-none">
      <CardHeader>
        <CardTitle className="text-rc-ink text-lg">New Score Alert</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Spot */}
          <div className="space-y-2">
            <Label htmlFor="spot" className="text-rc-ink">Spot</Label>
            <select
              id="spot"
              value={spotSlug}
              onChange={(e) => setSpotSlug(e.target.value)}
              required
              className="w-full bg-white border border-rc-rule rounded-lg px-3 py-2 text-rc-ink text-sm focus:outline-none focus:ring-2 focus:ring-rc-brand"
            >
              {grouped.map(([group, gSpots]) => (
                <optgroup key={group} label={group}>
                  {gSpots.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {spots.length === 0 && (
              <p className="text-xs text-rc-fair-ink">
                No published spots available yet.
              </p>
            )}
          </div>

          {/* Species */}
          <div className="space-y-2">
            <Label htmlFor="species" className="text-rc-ink">
              Species{' '}
              <span className="text-rc-ink-mute text-xs font-normal">
                (optional — leave blank for overall score)
              </span>
            </Label>
            <select
              id="species"
              value={speciesSlug}
              onChange={(e) => setSpeciesSlug(e.target.value)}
              disabled={speciesLoading}
              className="w-full bg-white border border-rc-rule rounded-lg px-3 py-2 text-rc-ink text-sm focus:outline-none focus:ring-2 focus:ring-rc-brand disabled:opacity-50"
            >
              <option value="">Any species (overall score)</option>
              {species.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            {speciesLoading && (
              <p className="text-xs text-rc-ink-mute">Loading species…</p>
            )}
          </div>

          {/* Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-rc-ink">Score threshold</Label>
              <span className="text-rc-brand font-mono font-bold">{threshold}</span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(v) => setThreshold(v[0] ?? 70)}
              min={50}
              max={95}
              step={5}
            />
            <p className="text-xs text-rc-ink-mute">
              We&apos;ll notify you when the RC score reaches at least {threshold}/100.
            </p>
          </div>

          {/* Cooldown */}
          <div className="space-y-2">
            <Label htmlFor="cooldown" className="text-rc-ink">Cooldown</Label>
            <select
              id="cooldown"
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
              className="w-full bg-white border border-rc-rule rounded-lg px-3 py-2 text-rc-ink text-sm focus:outline-none focus:ring-2 focus:ring-rc-brand"
            >
              <option value={6}>6 hours (most frequent)</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours (once per day)</option>
              <option value={48}>48 hours</option>
            </select>
            <p className="text-xs text-rc-ink-mute">
              Minimum time between notifications.
            </p>
          </div>

          {/* Delivery — same picker (and same inline phone verification) the
              spot-page alert dialog uses. */}
          <DeliveryChannelPicker
            emailOn={emailOn}
            onEmailChange={setEmailOn}
            smsOn={smsOn}
            onSmsChange={setSmsOn}
            onUpgradeRequired={() => setSmsUpgradeOpen(true)}
          />

          {error && (
            <div className="bg-rc-poor-bg border border-rc-poor/40 rounded-md p-3 text-sm text-rc-poor-ink">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 border-rc-rule text-rc-ink-soft hover:bg-rc-surface"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !spotSlug}
              className="flex-1 bg-rc-brand hover:bg-rc-brand-hover text-white"
            >
              {submitting ? 'Creating…' : 'Create alert'}
            </Button>
          </div>
        </form>
      </CardContent>

      <ProTrialModal
        open={smsUpgradeOpen}
        onOpenChange={setSmsUpgradeOpen}
        feature="sms-alerts"
        from="alerts"
      />
    </Card>
  );
}
