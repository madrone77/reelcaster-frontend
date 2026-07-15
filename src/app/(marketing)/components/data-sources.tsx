import { Anchor, Waves, Wind, Globe } from 'lucide-react';

const SOURCES = [
  { icon: Anchor, name: 'DFO / MPO', detail: 'tides · regulations' },
  { icon: Waves, name: 'NOAA', detail: 'buoys · water temp' },
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
        {SOURCES.map(({ icon: Icon, name, detail }) => (
          <div key={name} className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rc-ink text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-bold text-rc-ink">{name}</span>
              <span className="block font-rc-mono text-[10px] text-rc-ink-mute">
                {detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
