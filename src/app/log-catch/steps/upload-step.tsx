"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

/**
 * Step 1 — photo dropzone (visuals carried over from the pre-wizard page).
 */
export default function UploadStep({
  onFile,
  error,
}: {
  onFile: (f: File) => void;
  error: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    // The page heading is left-aligned like every other surface's — centring it
    // put "Log a catch" in the middle of the column while the mark above it and
    // every other page's h1 sat on the gridline. The drop zone below keeps its
    // own centred contents; that's a target, not a heading.
    <div>
      <div className="rc-label text-[10px] text-rc-ink-mute">
        REELCASTER · CATCH LOG
      </div>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] text-rc-ink">
        Log a catch
      </h1>
      <p className="mt-3 text-rc-ink-soft max-w-lg">
        Drop one photo. We read EXIF and run vision to pull species, lure, size,
        location and time, then attach the tide / wind / temp snapshot. You
        just confirm.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed py-16 px-6 text-center transition-colors ${
          dragOver
            ? "border-rc-brand bg-rc-brand-soft/40"
            : "border-rc-rule bg-rc-panel"
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-rc-brand-soft flex items-center justify-center">
          <Upload className="w-6 h-6 text-rc-brand" />
        </div>
        <div className="mt-4 text-xl font-bold text-rc-ink">
          Drop a fishing photo
        </div>
        <div className="mt-1 font-rc-mono text-[12px] text-rc-ink-mute">
          JPG · PNG · HEIC · WebP · EXIF read for time &amp; location
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-5 px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
        >
          Choose photo
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2 inline-block">
          {error}
        </div>
      )}
    </div>
  );
}
