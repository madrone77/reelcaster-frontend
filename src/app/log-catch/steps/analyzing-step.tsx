"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

const ITEMS = [
  "Reading EXIF (time, GPS)",
  "Running vision model",
  "Identifying species",
  "Pulling tide / wind / temp snapshot",
];

/**
 * Step 2 — the "analyzing" screen (mock parity): photo + progress checklist.
 * The real work is ONE preview call; the checklist advances on a timer up to
 * the last item, which holds until `done` flips, then the whole list checks
 * and `onComplete` fires.
 */
export default function AnalyzingStep({
  photoUrl,
  done,
  onComplete,
}: {
  photoUrl: string | null;
  done: boolean;
  onComplete: () => void;
}) {
  // stage = index of the item currently "active"; items below it are done.
  const [stage, setStage] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (done) return;
    if (stage >= ITEMS.length - 1) return;
    const t = setTimeout(() => setStage((s) => Math.min(s + 1, ITEMS.length - 1)), 1100);
    return () => clearTimeout(t);
  }, [stage, done]);

  useEffect(() => {
    if (!done || completedRef.current) return;
    completedRef.current = true;
    setStage(ITEMS.length);
    const t = setTimeout(onComplete, 650);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  return (
    <div className="flex flex-col items-center">
      {photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Your catch"
          className="w-full max-w-md rounded-2xl object-cover max-h-[420px] shadow-rc-panel"
        />
      )}

      <ul className="mt-10 space-y-4 text-left">
        {ITEMS.map((label, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "pending";
          return (
            <li key={label} className="flex items-center gap-3">
              {state === "done" ? (
                <span className="flex w-6 h-6 items-center justify-center rounded-full bg-rc-good">
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </span>
              ) : state === "active" ? (
                <span className="w-6 h-6 rounded-full border-[3px] border-rc-brand animate-pulse" />
              ) : (
                <span className="w-6 h-6 rounded-full border-[3px] border-rc-rule" />
              )}
              <span
                className={`text-[15px] ${
                  state === "pending" ? "text-rc-ink-mute" : "text-rc-ink"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
