import { Wind, Globe } from 'lucide-react';
import { CA, US } from 'country-flag-icons/react/3x2';

// "Trusted data sources" strip. The two government agencies carry their real
// national flag (accurate SVG from country-flag-icons), rendered grayscale so
// they sit as one muted, monochrome system with the two forecast models'
// line-icons: one quiet, authoritative treatment across all four, no colour
// spent and no shadow (flat, a hairline ring just defines the flag's edge).
//
// Layout: on phones the four sources sit in a tidy 2x2 grid under the label,
// so every glyph shares one column edge and every name starts at the same x.
// Wrapping a centred flex row instead left them ragged (two, then two, then a
// stray centred fifth). From md up it stays the single justified row.

const FLAG = { ca: CA, us: US } as const;

type Source =
  | { flag: 'ca' | 'us'; name: string; detail: string; icon?: undefined }
  | { icon: typeof Wind; name: string; detail: string; flag?: undefined };

const SOURCES: Source[] = [
  { flag: 'ca', name: 'DFO / MPO', detail: 'tides · regulations' },
  { flag: 'us', name: 'NOAA', detail: 'buoys · water temp' },
  { icon: Wind, name: 'ECMWF', detail: 'wind · pressure' },
  { icon: Globe, name: 'NCEP GFS', detail: 'global forecast' },
];

export default function DataSources() {
  return (
    <section className="border-b border-rc-rule bg-rc-panel">
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center gap-x-4 gap-y-3.5 px-5 py-6 md:flex md:px-6 md:flex-wrap md:justify-between md:gap-x-10 md:gap-y-4">
        <p className="col-span-2 font-rc-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-rc-ink-mute">
          Trusted data sources
        </p>
        {SOURCES.map((s) => {
          const Flag = s.flag ? FLAG[s.flag] : null;
          const Icon = s.icon ?? null;
          return (
            <div key={s.name} className="flex min-w-0 items-center gap-2 md:gap-3">
              <span className="flex h-5 w-6 shrink-0 items-center justify-center md:w-7">
                {Flag ? (
                  <span className="h-[13px] w-5 overflow-hidden rounded-[2px] ring-1 ring-rc-ink/10 md:h-[15px] md:w-6">
                    <Flag className="h-full w-full object-cover grayscale" />
                  </span>
                ) : Icon ? (
                  <Icon
                    className="h-[18px] w-[18px] text-rc-ink-mute md:h-5 md:w-5"
                    strokeWidth={1.75}
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-bold leading-tight text-rc-ink md:text-sm">
                  {s.name}
                </span>
                <span className="block truncate font-rc-mono text-[10px] leading-tight text-rc-ink-mute">
                  {s.detail}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
