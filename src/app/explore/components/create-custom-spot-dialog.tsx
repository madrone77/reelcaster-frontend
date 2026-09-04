"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Lock, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import { createCustomSpot, fetchScorableSpecies } from "@/lib/bluecaster-client";
import type { CreateCustomSpotResponse } from "@/lib/bluecaster/catch-ingest-types";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";

export interface CustomSpotSpeciesOption {
  id: string;
  name: string;
  slug?: string | null;
}

/**
 * Create-custom-spot modal (light rc-*). Opens after a Pro user drops a pin on
 * the map: name it, choose private/public, pick which species to score, and
 * create. Posts through the same-origin proxy (which re-checks Pro + attaches
 * the service key). Handles `outside_coverage` (BlueCaster's 50 km fence) and
 * `pro_required` with inline copy.
 */
export default function CreateCustomSpotDialog({
  open,
  onOpenChange,
  coords,
  speciesOptions,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coords: { lat: number; lng: number } | null;
  speciesOptions: CustomSpotSpeciesOption[];
  onCreated?: (spot: CreateCustomSpotResponse["spot"]) => void;
}) {
  const { session } = useAuth();

  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  // Species the CITY can score, fetched per pin. `speciesOptions` (derived
  // from the map viewport) is only the fallback now: it offers whatever
  // happens to be scoring on the spots currently loaded, which shrinks as the
  // angler pans and can never include a species no nearby spot scores.
  const [citySpecies, setCitySpecies] = useState<CustomSpotSpeciesOption[] | null>(
    null,
  );
  const [loadingSpecies, setLoadingSpecies] = useState(false);
  // Set once the spot exists. Holds the heads-up the angler needs: a forecast
  // is being built, or the reason there will not be one.
  const [created, setCreated] = useState<CreateCustomSpotResponse | null>(null);

  // Fresh state each time the modal opens for a new pin.
  useEffect(() => {
    if (!open) return;
    setName("");
    setVisibility("private");
    setPicked(new Set());
    setError(null);
    setUpsell(false);
    setCreated(null);
    setCitySpecies(null);
  }, [open, coords?.lat, coords?.lng]);

  // Load the city's scorable species for this pin. Failure is not fatal: the
  // viewport list still stands in, so a picker that is too short beats one
  // that will not open.
  useEffect(() => {
    if (!open || !coords) return;
    let cancelled = false;
    setLoadingSpecies(true);
    fetchScorableSpecies(coords.lat, coords.lng)
      .then((res) => {
        if (cancelled) return;
        if (!res) return;
        const list = res.species.map((sp) => ({ id: sp.id, name: sp.name }));
        setCitySpecies(list);
        // Everything scorable starts picked. The default has to be a full
        // forecast: an angler who names the spot and taps Create, the way a
        // Pro trialist did in his first hour, must not end up with a spot
        // that never scores. Deselecting is one tap per species.
        setPicked(new Set(list.map((sp) => sp.id)));
      })
      .finally(() => {
        if (!cancelled) setLoadingSpecies(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, coords]);

  const options = citySpecies ?? speciesOptions;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = async () => {
    if (!session?.access_token || !coords) {
      setError("Something went wrong. Try dropping the pin again.");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your spot a name.");
      return;
    }
    if (picked.size === 0) {
      setError("Pick at least one species to score here.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createCustomSpot(
      {
        name: trimmed,
        lat: coords.lat,
        lng: coords.lng,
        visibility,
        species_ids: [...picked],
      },
      session.access_token,
    );
    setSaving(false);
    if (!result.ok) {
      trackEvent("Custom Spot Create Failed", {
        reason: result.error,
        surface: "explore",
      });
      if (result.error === "pro_required") {
        setUpsell(true);
        return;
      }
      setError(
        result.message ??
          (result.error === "outside_coverage"
            ? "That spot is outside the waters ReelCaster covers yet."
            : result.error === "species_required"
              ? "Pick at least one species to score here."
              : "Couldn't create the spot. Try again."),
      );
      return;
    }
    // Keep the dialog open on the heads-up. BlueCaster answers before the
    // forecast exists, so closing here is what left an angler staring at a
    // spot with no explanation. It also has to carry the "everything you
    // picked is closed" case, which a toast makes far too easy to miss.
    trackEvent("Custom Spot Created", {
      visibility,
      species_count: picked.size,
      surface: "explore",
    });
    setCreated(result.data);
    onCreated?.(result.data.spot);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-lg p-6">
        <DialogTitle className="sr-only">Create a custom spot</DialogTitle>
        <DialogDescription className="sr-only">
          Name your spot, choose who can see it, and pick which species to score.
        </DialogDescription>

        <div className="rc-label text-[10px] text-rc-brand">NEW CUSTOM SPOT</div>
        <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-rc-ink">
          Add your own spot
        </h2>
        <p className="mt-1 text-sm text-rc-ink-soft">
          Drop it on the map, name it, and we&apos;ll score the species you pick
          here alongside the rest.
        </p>

        {/* Coordinates */}
        <div className="mt-5 rounded-xl bg-rc-brand-soft px-4 py-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rc-brand shrink-0" />
          <div className="font-rc-mono text-[12px] text-rc-ink">
            {coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : "No location picked"}
          </div>
        </div>

        {created ? (
          <div className="mt-6">
            <div className="rounded-xl border border-rc-rule bg-rc-surface px-4 py-4">
              <div className="font-bold text-rc-ink">{created.spot.name}</div>
              <p className="mt-1 text-sm text-rc-ink-soft">
                {created.message ?? "Your spot is saved."}
              </p>

              {(created.scored_species?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {created.scored_species!.map((sp) => (
                    <span
                      key={sp.species_id}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold ${
                        sp.scoring === "scoring"
                          ? "bg-rc-brand-soft text-rc-brand"
                          : "bg-rc-surface border border-rc-rule text-rc-ink-mute"
                      }`}
                    >
                      {sp.name ? shortName(sp.name) : "Species"}
                      {sp.scoring === "closed" && " · closed"}
                      {sp.scoring === "pending" && " · not yet"}
                    </span>
                  ))}
                </div>
              )}

              {(created.warnings ?? [])
                .filter((w) => w.code !== "regulations_closed")
                .map((w) => (
                  <p key={w.code} className="mt-3 text-[13px] text-rc-ink-soft">
                    {w.message}
                  </p>
                ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : upsell ? (
          <div className="mt-6">
            <div className="rounded-xl border border-rc-rule bg-rc-surface px-4 py-4">
              <div className="font-bold text-rc-ink">Custom spots are a Pro feature</div>
              <p className="mt-1 text-sm text-rc-ink-soft">
                Upgrade to add your own private spots and choose which species we
                score there.
              </p>
              <div className="flex gap-2 mt-3">
                <TrialModalButton
                  feature="custom-spots"
                  from="custom-spot-dialog"
                  className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
                >
                  Upgrade to Pro
                </TrialModalButton>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2.5 rounded-lg border border-rc-rule text-rc-ink text-sm font-medium hover:bg-rc-surface transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Name */}
            <div className="mt-6">
              <div className="rc-label text-[9px] text-rc-ink-mute">NAME</div>
              {/* No autoFocus. On a phone that raised the keyboard the
                  instant the pin was dropped, over the coordinates the angler
                  had just placed and the form below them. The field is the
                  obvious next tap either way. */}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. My Secret Reef"
                className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:border-rc-brand"
              />
            </div>

            {/* Visibility */}
            <div className="mt-6">
              <div className="rc-label text-[9px] text-rc-ink-mute">VISIBILITY</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <VisButton
                  active={visibility === "private"}
                  onClick={() => setVisibility("private")}
                  icon={<Lock className="w-4 h-4" />}
                  title="Private"
                  sub="Only you"
                />
                <VisButton
                  active={visibility === "public"}
                  onClick={() => setVisibility("public")}
                  icon={<Globe className="w-4 h-4" />}
                  title="Public"
                  sub="Anyone can find it"
                />
              </div>
            </div>

            {/* Species */}
            <div className="mt-6">
              <div className="rc-label text-[9px] text-rc-ink-mute">
                SPECIES TO SCORE ({picked.size})
              </div>
              <div className="text-rc-ink-soft mt-1 text-sm">
                Which species should we score here. Tap one to leave it out.
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {loadingSpecies && options.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-rc-ink-mute">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading species for this area
                  </div>
                )}
                {!loadingSpecies && options.length === 0 && (
                  <div className="text-sm text-rc-ink-mute">
                    No species available for this area yet.
                  </div>
                )}
                {options.map((s) => {
                  const sel = picked.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                        sel
                          ? "border-rc-brand bg-rc-brand text-white"
                          : "border-rc-rule bg-rc-panel text-rc-ink hover:border-rc-ink-mute"
                      }`}
                    >
                      {shortName(s.name)}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-rc-rule-soft">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2.5 rounded-xl border border-rc-rule text-rc-ink text-sm font-semibold hover:bg-rc-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || picked.size === 0}
                className="px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                Create spot →
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VisButton({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? "border-rc-brand bg-rc-brand-soft"
          : "border-rc-rule bg-rc-panel hover:border-rc-ink-mute"
      }`}
    >
      <div className="flex items-center gap-2 text-rc-ink">
        <span className={active ? "text-rc-brand" : "text-rc-ink-mute"}>{icon}</span>
        <span className="font-bold">{title}</span>
      </div>
      <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">{sub}</div>
    </button>
  );
}

function shortName(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}
