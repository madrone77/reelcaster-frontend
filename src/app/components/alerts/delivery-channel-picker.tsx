"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Mail, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import {
  formatNational,
  fromE164,
  isValidNational,
  nationalDigits,
  toE164,
} from "@/lib/phone";

/**
 * Email + SMS delivery picker for the alert forms, including the inline
 * phone-verification flow (POST /api/alerts/verify-phone to send a code, PUT
 * to confirm).
 *
 * Shared by the spot-page dialog and the /alerts form. SMS has three states:
 * verified Pro toggles it; unverified Pro gets an inline verify flow; everyone
 * else gets an upgrade prompt. `/api/alerts` re-checks `phone_verified` and
 * silently strips 'sms' from a payload it doesn't trust, so this component is
 * the convenience layer, not the gate.
 */
export default function DeliveryChannelPicker({
  emailOn,
  onEmailChange,
  smsOn,
  onSmsChange,
  onUpgradeRequired,
  resetKey,
  className,
}: {
  emailOn: boolean;
  onEmailChange: (on: boolean) => void;
  smsOn: boolean;
  onSmsChange: (on: boolean) => void;
  /**
   * Fires when a non-Pro user taps the SMS upgrade button — the host opens
   * `<ProTrialModal feature="sms-alerts">`. Without it the row links to
   * /plans, for hosts that can't own a modal.
   */
  onUpgradeRequired?: () => void;
  /** Change this to collapse the verify UI — e.g. pass a dialog's `open`. */
  resetKey?: unknown;
  className?: string;
}) {
  const { user, session } = useAuth();
  const { isPaid, phoneVerified, phoneE164, refresh } = useSubscription();

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"enter-phone" | "enter-code">(
    "enter-phone",
  );
  const [phoneInput, setPhoneInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  const smsAvailable = isPaid && phoneVerified;

  useEffect(() => {
    setVerifyOpen(false);
    setVerifyStep("enter-phone");
    setPhoneInput(nationalDigits(phoneE164 ?? ""));
    setCodeInput("");
    setVerifyError(null);
    setVerifyInfo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const handleSendCode = async () => {
    setVerifyError(null);
    setVerifyInfo(null);
    const e164 = toE164(phoneInput);
    if (!e164) {
      setVerifyError("Enter a 10-digit mobile number, like (250) 555-0134.");
      return;
    }
    if (!session?.access_token) {
      setVerifyError("Please sign in again.");
      return;
    }
    setVerifyBusy(true);
    try {
      const res = await fetch("/api/alerts/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: e164 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          // 503 = the texting service is unreachable right now, not a feature
          // we haven't shipped. Say so, and point at the channel that works.
          res.status === 503
            ? "We can't send texts at the moment. Try again shortly, or use email delivery in the meantime."
            : (body.error ?? "Couldn't send the code."),
        );
      }
      setVerifyStep("enter-code");
      setVerifyInfo(
        `We texted a code to ${formatNational(phoneInput)}. It may take a minute.`,
      );
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Couldn't send the code.",
      );
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    setVerifyError(null);
    setVerifyInfo(null);
    if (codeInput.length < 4) {
      setVerifyError("Enter the code we texted you.");
      return;
    }
    if (!session?.access_token) {
      setVerifyError("Please sign in again.");
      return;
    }
    setVerifyBusy(true);
    try {
      const res = await fetch("/api/alerts/verify-phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: toE164(phoneInput), code: codeInput }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.approved) {
        throw new Error(body.error ?? "That code didn't match. Try again.");
      }
      // Verified — flip the subscription state so smsAvailable becomes true,
      // collapse the verify UI, and pre-arm the SMS channel for this alert.
      setVerifyOpen(false);
      onSmsChange(true);
      refresh();
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "That code didn't match.",
      );
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="rc-label text-[9px] text-rc-ink-mute">DELIVERY</div>

      <button
        type="button"
        onClick={() => onEmailChange(!emailOn)}
        className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 flex items-center gap-3 text-left"
      >
        <Mail className="w-5 h-5 text-rc-brand shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-rc-ink">Email</div>
          <div className="font-rc-mono text-[11px] text-rc-ink-mute truncate">
            {user?.email ?? "your email"}
          </div>
        </div>
        <Toggle on={emailOn} />
      </button>

      <div className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Smartphone
            className={`w-5 h-5 shrink-0 ${
              smsAvailable ? "text-rc-brand" : "text-rc-ink-mute"
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-rc-ink flex items-center gap-1.5">
              SMS
              {smsAvailable && (
                <CheckCircle2 className="w-3.5 h-3.5 text-rc-good" />
              )}
            </div>
            <div className="font-rc-mono text-[11px] text-rc-ink-mute truncate">
              {smsAvailable
                ? (fromE164(phoneE164) || "Instant texts")
                : isPaid
                  ? "Verify your phone to enable SMS"
                  : "Available with Pro"}
            </div>
          </div>
          {smsAvailable ? (
            <button type="button" onClick={() => onSmsChange(!smsOn)}>
              <Toggle on={smsOn} />
            </button>
          ) : isPaid ? (
            <button
              type="button"
              onClick={() => {
                setVerifyOpen((v) => !v);
                setVerifyError(null);
                setVerifyInfo(null);
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-xs font-semibold transition-colors"
            >
              {verifyOpen ? "CANCEL" : "VERIFY"}
            </button>
          ) : onUpgradeRequired ? (
            <button
              type="button"
              onClick={onUpgradeRequired}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-xs font-semibold transition-colors"
            >
              UPGRADE
            </button>
          ) : (
            <Link
              href="/plans?from=alerts&feature=alerts"
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-xs font-semibold transition-colors"
            >
              UPGRADE
            </Link>
          )}
        </div>

        {isPaid && !phoneVerified && verifyOpen && (
          <div className="mt-3 space-y-2 border-t border-rc-rule-soft pt-3">
            {verifyStep === "enter-phone" ? (
              <>
                {/* Fixed +1: every region we sell is North American, so the
                    country code is ours to know, not theirs to type. */}
                <div className="flex w-full items-center rounded-lg border border-rc-rule bg-rc-panel focus-within:border-rc-brand">
                  <span
                    aria-hidden="true"
                    className="pl-3 pr-2 font-rc-mono text-sm text-rc-ink-mute select-none"
                  >
                    +1
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-label="Phone number"
                    value={formatNational(phoneInput)}
                    onChange={(e) => setPhoneInput(nationalDigits(e.target.value))}
                    placeholder="(250) 555-0134"
                    className="w-full rounded-r-lg bg-transparent py-2 pr-3 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={verifyBusy || !isValidNational(phoneInput)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-rc-brand py-2 text-sm font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
                >
                  {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send code
                </button>
              </>
            ) : (
              <>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codeInput}
                  onChange={(e) =>
                    setCodeInput(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="123456"
                  className="w-full rounded-lg border border-rc-rule bg-rc-panel px-3 py-2 text-center text-sm tracking-[0.3em] text-rc-ink placeholder:tracking-normal placeholder:text-rc-ink-mute focus:border-rc-brand focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVerifyStep("enter-phone");
                      setCodeInput("");
                      setVerifyError(null);
                      setVerifyInfo(null);
                    }}
                    disabled={verifyBusy}
                    className="rounded-lg border border-rc-rule px-3 py-2 text-sm font-semibold text-rc-ink transition-colors hover:bg-rc-panel disabled:opacity-60"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCode}
                    disabled={verifyBusy || codeInput.length < 4}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rc-brand py-2 text-sm font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
                  >
                    {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm
                  </button>
                </div>
              </>
            )}
            {verifyError && (
              <div className="rounded-lg bg-rc-poor-bg px-3 py-2 text-[12px] text-rc-poor-ink">
                {verifyError}
              </div>
            )}
            {verifyInfo && (
              <div className="rounded-lg bg-rc-brand-soft px-3 py-2 text-[12px] text-rc-brand">
                {verifyInfo}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center w-10 h-6 rounded-full transition-colors ${
        on ? "bg-rc-brand" : "bg-rc-rule"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}
