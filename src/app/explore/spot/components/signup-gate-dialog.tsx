"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useAnalytics } from "@/hooks/use-analytics";
import { CheckCircle2 } from "lucide-react";

/** Which CTA opened the gate — drives the headline copy. */
export type AuthIntent = "catch" | "alert";

const INTENT_COPY: Record<AuthIntent, { label: string; lead: string; verb: string }> = {
  catch: { label: "SAVE YOUR CATCH", lead: "Sign up to log catches at", verb: "logging your catch" },
  alert: { label: "GET ALERTS", lead: "Sign up to set alerts for", verb: "setting your alert" },
};

/**
 * Sign-up gate shown when a signed-out angler taps "Set alert" or "Log catch"
 * on the spot-detail page (per the mockup). Passwordless only — Continue with
 * Google (existing OAuth) + an email magic link. The headline names the spot
 * and adapts to the intent that opened it.
 */
export default function SignupGateDialog({
  open,
  onOpenChange,
  intent,
  spotName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: AuthIntent;
  spotName: string;
}) {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const { trackEvent } = useAnalytics();

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Fresh state every time the gate opens.
  useEffect(() => {
    if (open) {
      setMode("signup");
      setEmail("");
      setError("");
      setGoogleLoading(false);
      setLinkLoading(false);
      setSent(false);
    }
  }, [open]);

  const copy = INTENT_COPY[intent];
  const lead = mode === "signup" ? copy.lead : "Sign in to continue at";

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setError(error.message);
        setGoogleLoading(false);
        return;
      }
      trackEvent("Sign In", { method: "google", source: `spot-gate-${intent}` });
      // Browser is redirecting to Google — keep the button in its loading state.
    } catch {
      setError("Could not start Google sign-in");
      setGoogleLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email first");
      return;
    }
    setError("");
    setLinkLoading(true);
    try {
      const { error } = await signInWithMagicLink(trimmed);
      if (error) {
        setError(error.message);
        setLinkLoading(false);
        return;
      }
      setSent(true);
      setLinkLoading(false);
      trackEvent(mode === "signup" ? "Sign Up" : "Sign In", {
        method: "magic_link",
        source: `spot-gate-${intent}`,
      });
    } catch {
      setError("Could not send the magic link");
      setLinkLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-7">
        {sent ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 className="w-12 h-12 text-rc-good" />
            <DialogTitle className="text-xl font-bold text-rc-ink">
              Check your email
            </DialogTitle>
            <DialogDescription className="font-rc-mono text-sm text-rc-ink-soft">
              We sent a magic link to{" "}
              <span className="font-semibold text-rc-ink">{email}</span>. Tap it
              to finish {copy.verb}.
            </DialogDescription>
          </div>
        ) : (
          <>
            {/* a11y title/description (visible heading rendered below) */}
            <DialogTitle className="sr-only">
              {lead} {spotName}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Sign up with Google or an email magic link. Free, takes about 30
              seconds.
            </DialogDescription>

            <div>
              <div className="rc-label text-[10px] text-rc-brand">
                {mode === "signup" ? copy.label : "WELCOME BACK"}
              </div>
              <div className="mt-3 text-3xl font-bold leading-tight tracking-[-0.02em] text-rc-ink">
                {lead}
              </div>
              <div className="mt-1 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-rc-brand">
                {spotName}
              </div>
              <div className="mt-3 font-rc-mono text-[12px] text-rc-ink-mute">
                Free · 30 seconds · we keep it private
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3.5 text-rc-ink font-semibold hover:bg-rc-surface transition-colors disabled:opacity-60"
            >
              {googleLoading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-rc-ink-mute border-t-transparent" />
              ) : (
                <GoogleGlyph />
              )}
              Continue with Google
            </button>

            <div className="text-center font-rc-mono text-[11px] tracking-[0.08em] text-rc-ink-mute">
              OR
            </div>

            <form onSubmit={handleMagicLink}>
              <div className="flex items-center gap-2 rounded-xl border border-rc-rule bg-rc-panel pl-4 pr-2 py-1 focus-within:border-rc-brand transition-colors">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Add email"
                  disabled={linkLoading}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-rc-ink placeholder:text-rc-ink-mute py-2"
                />
                <button
                  type="submit"
                  disabled={linkLoading}
                  className="shrink-0 px-2 py-1.5 font-rc-mono text-sm font-semibold text-rc-brand hover:text-rc-brand-hover transition-colors disabled:opacity-60"
                >
                  {linkLoading ? "Sending…" : "Send magic link"}
                </button>
              </div>
            </form>

            <div className="text-center font-rc-mono text-[12px] text-rc-ink-mute">
              {mode === "signup" ? "Already have an account? " : "New here? "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError("");
                }}
                className="text-rc-brand font-semibold hover:underline"
              >
                {mode === "signup" ? "Sign in" : "Sign up"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
      />
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#FBBC05"
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"
      />
    </svg>
  );
}
