"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shown when a locked forecast day is tapped. Two variants:
 * - "pro" (default): a signed-in free user tapped a Pro day (8–14) —
 *   routes to pricing.
 * - "signup": a signed-out visitor tapped a locked day — routes to the
 *   free sign-up (days 3–7 are free-account days; an account is also the
 *   first step toward Pro).
 */
export default function UpgradeDialog({
  open,
  onOpenChange,
  variant = "pro",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "pro" | "signup";
}) {
  const copy =
    variant === "signup"
      ? {
          title: "See the week ahead, free",
          description:
            "Browsing shows the next 2 days. Create a free account for the 7-day forecast. It takes about 30 seconds, no card needed.",
          cta: "Sign up free",
          href: "/signup",
        }
      : {
          title: "Days 8–14 are Pro",
          description:
            "The free forecast runs 7 days out. Upgrade to Pro for the full 14-day outlook, per-day best windows, and more alerts.",
          cta: "Upgrade to Pro",
          href: "/pricing",
        };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-rc-ink">{copy.title}</DialogTitle>
          <DialogDescription className="text-rc-ink-soft">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <Link
            href={copy.href}
            className="flex-1 text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors"
          >
            {copy.cta}
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2.5 rounded-lg border border-rc-rule text-rc-ink text-sm font-medium hover:bg-rc-surface transition-colors"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
