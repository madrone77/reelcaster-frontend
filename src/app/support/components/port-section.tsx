'use client';

import type { ReactNode } from 'react';

interface Props {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}

/**
 * Shared heading frame for every Port section, so the six sections cannot
 * drift into six slightly different type scales.
 */
export default function PortSection({ eyebrow, title, intro, children }: Props) {
  return (
    <section>
      <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-[-0.01em] text-rc-ink">
        {title}
      </h2>
      {intro && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rc-ink-soft">
          {intro}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  );
}
