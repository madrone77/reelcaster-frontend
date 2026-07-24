import { Wind, Globe } from 'lucide-react';
import { CA, US } from 'country-flag-icons/react/3x2';

// "Trusted data sources" strip. The two government agencies carry their real
// national flag (accurate SVG from country-flag-icons); the two forecast models
// keep a neutral line-icon. No containers behind the marks.

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
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 py-6 md:justify-between">
        <p className="font-rc-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-rc-ink-mute">
          Trusted data sources
        </p>
        {SOURCES.map((s) => {
          const Flag = s.flag ? FLAG[s.flag] : null;
          const Icon = s.icon ?? null;
          return (
            <div key={s.name} className="flex items-center gap-3">
              {Flag ? (
                <span className="h-5 w-7 shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-rc-ink/10">
                  <Flag className="h-full w-full object-cover" />
                </span>
              ) : Icon ? (
                <span className="flex h-5 w-7 shrink-0 items-center justify-center text-rc-ink-mute">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
              ) : null}
              <span>
                <span className="block text-sm font-bold text-rc-ink">{s.name}</span>
                <span className="block font-rc-mono text-[10px] text-rc-ink-mute">
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
