"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Compass,
  MapPin,
  Plus,
  ChevronRight,
  Heart,
  Lock,
  Globe,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { fetchMyCustomSpots, type OwnedCustomSpot } from "@/lib/bluecaster-client";
import { tierFor, TIER_PILL } from "@/app/explore/lib/explore-data";

// "victoria-waterfront-ad3f9b" → "Victoria Waterfront" (strip id suffix, title-case).
function prettify(slug: string): string {
  return slug
    .replace(/-[0-9a-f]{5,}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function firstName(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Logged-in landing: the angler's home. Two collections — the custom spots they
 * created (rich cards with today's score, from GET /api/v1/anglers/:id/spots)
 * and their saved favourites (localStorage rc-fav:<slug>). Auth-gated by the
 * global AuthGate (this route isn't in the public allowlist).
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [custom, setCustom] = useState<OwnedCustomSpot[] | null>(null);
  const [favSlugs, setFavSlugs] = useState<string[] | null>(null);

  // Custom spots (owner-scoped backend fetch).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchMyCustomSpots()
      .then((rows) => {
        if (!cancelled) setCustom(rows);
      })
      .catch(() => {
        if (!cancelled) setCustom([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Favourites (localStorage rc-fav:<slug>).
  useEffect(() => {
    try {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("rc-fav:") && localStorage.getItem(k) === "1") {
          out.push(k.slice("rc-fav:".length));
        }
      }
      out.sort((a, b) => prettify(a).localeCompare(prettify(b)));
      setFavSlugs(out);
    } catch {
      setFavSlugs([]);
    }
  }, []);

  const name = firstName(user?.email);

  return (
    <div className="min-h-dvh bg-rc-page">
      <header className="bg-rc-panel border-b border-rc-rule">
        <div className="max-w-2xl mx-auto px-5 pt-10 pb-6">
          <div className="flex items-center gap-2 text-rc-brand mb-2">
            <Compass className="w-5 h-5" />
            <span className="rc-label text-[10px]">Your dashboard</span>
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-rc-ink">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-rc-ink-soft">
            Your spots and saved favourites, all in one place.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rc-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-rc-brand-hover transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Explore the map
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-8">
        {/* ── Your custom spots ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-rc-ink">Your spots</h2>
            {custom && custom.length > 0 && (
              <span className="font-rc-mono text-[11px] text-rc-ink-mute">
                {custom.length} {custom.length === 1 ? "spot" : "spots"}
              </span>
            )}
          </div>

          {custom === null ? (
            <SkeletonRows />
          ) : custom.length === 0 ? (
            <EmptyCard
              icon={<Plus className="w-8 h-8 text-rc-ink-mute mx-auto mb-3" />}
              title="No custom spots yet"
              body="On the map, tap “Create custom spot”, drop a pin, and pick the species to score there."
              cta="Create a spot"
              href="/explore"
            />
          ) : (
            <ul className="space-y-2.5">
              {custom.map((spot) => (
                <li key={spot.id}>
                  <Link
                    href={`/explore/spot/${spot.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3.5 hover:border-rc-brand/40 transition-colors"
                  >
                    <ScoreChip score={spot.score} status={spot.score_status} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-rc-ink truncate">
                          {spot.name}
                        </span>
                        <VisibilityTag visibility={spot.visibility} />
                      </span>
                      <span className="block font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
                        {spot.score_status === "pending"
                          ? "Scoring soon — new spot"
                          : spot.best_species_name
                            ? `Best: ${spot.best_species_name}`
                            : "Your custom spot"}
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-rc-ink-mute shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Favourites ───────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-rc-ink">Favourites</h2>
            {favSlugs && favSlugs.length > 0 && (
              <Link
                href="/favorites"
                className="font-rc-mono text-[11px] text-rc-brand hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          {favSlugs === null ? (
            <SkeletonRows />
          ) : favSlugs.length === 0 ? (
            <EmptyCard
              icon={<Heart className="w-8 h-8 text-rc-ink-mute mx-auto mb-3" />}
              title="No saved spots yet"
              body="Tap the heart on any spot to save it here for quick access."
              cta="Explore the map"
              href="/explore"
            />
          ) : (
            <ul className="space-y-2.5">
              {favSlugs.map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/explore/spot/${slug}`}
                    className="flex items-center gap-3 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3.5 hover:border-rc-brand/40 transition-colors"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft text-rc-brand">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-rc-ink truncate">
                        {prettify(slug)}
                      </span>
                      <span className="block font-rc-mono text-[11px] text-rc-ink-mute">
                        Saved spot
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-rc-ink-mute shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────

function ScoreChip({
  score,
  status,
}: {
  score: number | null;
  status: "scored" | "pending";
}) {
  if (status === "pending" || score === null) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-surface text-rc-ink-mute">
        <MapPin className="w-4 h-4" />
      </span>
    );
  }
  const tier = tierFor(score);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-rc-mono text-[13px] font-bold ${TIER_PILL[tier]}`}
    >
      {score}
    </span>
  );
}

function VisibilityTag({ visibility }: { visibility: "private" | "public" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
      {visibility === "private" ? (
        <Lock className="w-2.5 h-2.5" />
      ) : (
        <Globe className="w-2.5 h-2.5" />
      )}
      {visibility}
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-rc-rule bg-rc-surface animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-8 text-center">
      {icon}
      <p className="text-base font-semibold text-rc-ink mb-1">{title}</p>
      <p className="text-sm text-rc-ink-soft mb-5 max-w-sm mx-auto">{body}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg bg-rc-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-rc-brand-hover transition-colors"
      >
        <MapPin className="w-4 h-4" />
        {cta}
      </Link>
    </div>
  );
}
