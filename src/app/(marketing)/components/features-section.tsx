import { Target, Clock, NotebookPen } from 'lucide-react';

const FEATURES = [
  {
    icon: Target,
    title: '14-day forecast',
    body: 'See the fishing outlook two weeks ahead and plan trips around the best opportunities.',
  },
  {
    icon: Clock,
    title: 'Custom alerts',
    body: 'Get notified by email + SMS when conditions cross your thresholds, so you never miss a prime window.',
  },
  {
    icon: NotebookPen,
    title: 'Catch log',
    body: 'Record catches, locations, species, and conditions to learn what works best over time.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" data-testid="homepage-features" className="bg-rc-panel">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <h2 className="text-balance text-2xl md:text-3xl font-black tracking-[-0.02em] text-rc-ink">
          Everything you need in one place.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded border border-rc-rule/70 bg-rc-surface/60 p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rc-brand-soft text-rc-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-base font-bold text-rc-ink">{title}</h3>
              <p className="mt-2 text-pretty text-xs leading-relaxed text-rc-ink-mute">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
