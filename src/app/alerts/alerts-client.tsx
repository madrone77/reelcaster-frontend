'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Plus, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import ExploreTopBar from '@/app/explore/components/explore-top-bar';
import { CustomAlertsList } from '@/app/components/alerts/custom-alerts-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AlertProfile } from '@/lib/custom-alert-engine';
import ScoreAlertForm, { type ScoreAlertFormValue } from './score-alert-form';
import UpgradeRequiredModal from '@/app/components/paywall/upgrade-required-modal';

export interface AlertsSpot {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  city_name: string;
  province_code: string;
}

interface Props {
  spots: AlertsSpot[];
}

export default function AlertsClient({ spots }: Props) {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const { tier, isPaid, loading: subLoading } = useSubscription();

  const [profiles, setProfiles] = useState<AlertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/alerts');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    (async () => {
      try {
        const res = await fetch('/api/alerts', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to load alerts');
        const data = await res.json();
        setProfiles(data.profiles ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load alerts');
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const handleCreate = async (form: ScoreAlertFormValue) => {
    if (!session?.access_token) return;
    setError(null);

    const spot = spots.find((s) => s.slug === form.spotSlug);
    if (!spot) {
      setError('Pick a spot first');
      return;
    }

    const payload = {
      name: `${form.speciesName ?? 'Score'} ≥${form.threshold} at ${spot.name}`,
      location_lat: spot.lat,
      location_lng: spot.lng,
      location_name: spot.name,
      triggers: {
        fishing_score: {
          enabled: true,
          min_score: form.threshold,
          species: form.speciesSlug ?? undefined,
        },
      },
      logic_mode: 'AND' as const,
      cooldown_hours: form.cooldownHours,
      alert_kind: 'score' as const,
      target_bluecaster_spot_slug: spot.slug,
      target_species: form.speciesSlug ?? null,
      score_threshold: form.threshold,
      delivery_channels: ['email' as const],
    };

    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? 'Failed to create alert');
      if (body.upgrade_required) {
        setUpgradeOpen(true);
        return;
      }
      return;
    }

    setProfiles([body.profile, ...profiles]);
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!session?.access_token) return;
    const res = await fetch(`/api/alerts?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setProfiles(profiles.filter((p) => p.id !== id));
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    if (!session?.access_token) return;
    const res = await fetch('/api/alerts', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id, is_active: isActive }),
    });
    if (res.ok) {
      const { profile } = await res.json();
      setProfiles(profiles.map((p) => (p.id === id ? profile : p)));
    }
  };

  const handleDuplicate = async (source: AlertProfile) => {
    if (!session?.access_token) return;
    if (atLimit) {
      setUpgradeOpen(true);
      return;
    }
    // The API response carries extra fields beyond the engine's AlertProfile
    // (alert_kind, target_*, score_threshold, delivery_channels). Pass them
    // through opaquely so we duplicate score-alerts and composite alerts the
    // same way.
    const extras = source as unknown as Record<string, unknown>;
    const payload = {
      name: `${source.name} (copy)`,
      location_lat: source.location_lat,
      location_lng: source.location_lng,
      location_name: source.location_name,
      triggers: source.triggers,
      logic_mode: source.logic_mode,
      cooldown_hours: source.cooldown_hours,
      active_hours: source.active_hours,
      alert_kind: extras.alert_kind ?? 'composite',
      target_bluecaster_spot_slug: extras.target_bluecaster_spot_slug ?? null,
      target_species: extras.target_species ?? null,
      score_threshold: extras.score_threshold ?? null,
      delivery_channels: extras.delivery_channels ?? ['email'],
      active: source.is_active,
    };
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      if (body.upgrade_required) {
        setUpgradeOpen(true);
        return;
      }
      setError(body.error ?? 'Failed to duplicate alert');
      return;
    }
    setProfiles([body.profile, ...profiles]);
  };

  if (authLoading || !user) return null;

  const atLimit = !isPaid && profiles.length >= 1;
  const showLimitNotice = atLimit && !showForm;

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">
              Alerts
            </h1>
            <div className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
              Email alerts when the score peaks at your spots
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-rc-ink-mute">
              Get notified when the RC score peaks at your spot.{' '}
              <Link
                href="/profile/custom-alerts"
                className="text-rc-brand hover:text-rc-brand-hover"
              >
                Advanced custom alerts →
              </Link>
            </p>
            {!showForm && (
              <Button
                onClick={() => (atLimit ? setUpgradeOpen(true) : setShowForm(true))}
                disabled={subLoading}
                className="gap-2 bg-rc-brand hover:bg-rc-brand-hover text-white"
                data-testid="alerts-new-button"
              >
                <Plus className="h-4 w-4" />
                {atLimit ? 'Upgrade for more' : 'New Score Alert'}
              </Button>
            )}
          </div>

          {error && (
            <Card className="border-rc-poor/40 bg-rc-poor-bg shadow-none">
              <CardContent className="py-4">
                <p className="text-rc-poor-ink text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {showLimitNotice && (
            <Card className="bg-rc-brand-soft border-rc-brand-soft2 shadow-none">
              <CardContent className="py-5 flex items-start gap-3">
                <Lock className="h-5 w-5 text-rc-brand flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-rc-ink font-semibold mb-1">
                    Free tier: 1 alert active
                  </p>
                  <p className="text-sm text-rc-ink-mute mb-3">
                    Upgrade to Pro for up to 10 alerts plus SMS delivery.
                  </p>
                  <Link
                    href="/pricing?from=alerts"
                    className="inline-flex items-center px-4 py-2 bg-rc-brand hover:bg-rc-brand-hover rounded-md text-sm font-semibold text-white transition-colors"
                  >
                    See Pro pricing →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {showForm ? (
            <ScoreAlertForm
              spots={spots}
              onSubmit={handleCreate}
              onCancel={() => {
                setShowForm(false);
                setError(null);
              }}
            />
          ) : loading ? (
            <Card className="border-rc-rule shadow-none">
              <CardContent className="py-12 flex flex-col items-center text-rc-ink-mute">
                <div className="animate-spin h-8 w-8 border-2 border-rc-brand border-t-transparent rounded-full mb-4" />
                Loading alerts…
              </CardContent>
            </Card>
          ) : profiles.length === 0 ? (
            <Card className="border-rc-rule shadow-none">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rc-surface rounded-full flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-rc-ink-mute" />
                </div>
                <h3 className="text-lg font-semibold text-rc-ink mb-2">
                  No alerts yet
                </h3>
                <p className="text-rc-ink-mute mb-6 max-w-md">
                  Create a Score Alert and we&apos;ll email you the moment a peak
                  window opens at your spot.
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  disabled={atLimit}
                  className="gap-2 bg-rc-brand hover:bg-rc-brand-hover text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create your first alert
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CustomAlertsList
              profiles={profiles}
              onEdit={(p) => router.push(`/profile/custom-alerts?edit=${p.id}`)}
              onDelete={handleDelete}
              onToggleActive={handleToggle}
              onDuplicate={handleDuplicate}
            />
          )}

          {/* Footer info */}
          <Card className="border-rc-rule shadow-none">
            <CardContent className="py-5 text-sm text-rc-ink-mute space-y-2">
              <p>
                <strong className="text-rc-ink">How it works:</strong> we check
                conditions every 30 minutes and email you when the score crosses
                your threshold (subject to cooldown).
              </p>
              <p>
                <strong className="text-rc-ink">SMS:</strong> coming soon — Pro
                Intel users will be able to verify a phone for instant texts.
              </p>
              <p>
                Current tier: <strong className="text-rc-ink">{tier}</strong>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <UpgradeRequiredModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature="alerts"
        headline="More alerts with Pro"
        bullets={[
          'Up to 10 alert profiles',
          'SMS delivery in addition to email',
          'Composite triggers (wind + tide + pressure + score)',
          'Pause / duplicate / history per alert',
        ]}
      />
    </div>
  );
}
