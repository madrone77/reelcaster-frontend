import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { submitTestimonial, type TestimonialField } from '@/lib/bluecaster';

// reelcaster.com/testimonials: five stars, a name, and a box.
//
// Nothing links here on purpose. It is the page you send someone after they
// have said something kind, so their words arrive in their own hand with their
// name on them. No account, no sign-in wall: sending the form is the
// permission, and the line above the button says so.
//
// The stars are five radios drawn as stars and filled by CSS, and the form is
// a server action, so the page works with no JavaScript at all. A refused
// field comes back as ?e=<field> with the typed text carried along, and the
// message lands next to the field that needs it.

export const metadata: Metadata = {
  title: 'Leave a testimonial',
  description: 'Tell us how ReelCaster has worked for you.',
  // Unlinked and handed out by hand. Not for search engines.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const STARS = [1, 2, 3, 4, 5] as const;
const NAME_MAX = 80;
const BODY_MAX = 1500;

const ERRORS: Record<TestimonialField, string> = {
  name: 'Add your name.',
  rating: 'Pick a star rating.',
  body: 'Write a sentence or two.',
};

function isField(v: unknown): v is TestimonialField {
  return v === 'name' || v === 'rating' || v === 'body';
}

interface PageProps {
  searchParams: Promise<{
    saved?: string;
    e?: string;
    name?: string;
    rating?: string;
    body?: string;
  }>;
}

export default async function TestimonialsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const failed = isField(sp.e) ? sp.e : sp.e === 'send' ? 'send' : null;
  const draft = {
    name: typeof sp.name === 'string' ? sp.name : '',
    rating: Number(sp.rating) || 0,
    body: typeof sp.body === 'string' ? sp.body : '',
  };

  if (sp.saved === '1') {
    return (
      <article className="max-w-xl mx-auto px-6 pt-14 pb-20 md:pt-20">
        <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
          Testimonials
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-rc-ink mb-4">
          Thank you.
        </h1>
        <p className="text-base leading-relaxed text-rc-ink-soft">
          It goes straight to the person who builds ReelCaster. If it ends up
          on the site it will be in your words, with the name you gave and
          nothing else.
        </p>
      </article>
    );
  }

  return (
    <article className="max-w-xl mx-auto px-6 pt-14 pb-20 md:pt-20">
      <style>{STAR_CSS}</style>
      <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute mb-3">
        Testimonials
      </p>
      <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-rc-ink mb-4">
        Leave a testimonial
      </h1>
      <p className="text-base leading-relaxed text-rc-ink-soft">
        A few honest lines about how ReelCaster has worked for you. The
        specifics are the useful part: which water, which fish, what it got
        right.
      </p>

      <form
        action={save}
        id="tm"
        noValidate
        className="mt-8 bg-rc-panel border border-rc-rule rounded-xl p-5 sm:p-6 space-y-6"
      >
        <fieldset>
          <legend className="font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute">
            How many stars?
          </legend>
          <div className="tm-stars mt-2.5 flex flex-row-reverse justify-end gap-1">
            {[...STARS].reverse().map((n) => (
              <label key={n} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  defaultChecked={draft.rating === n}
                  className="peer sr-only"
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                />
                <svg
                  viewBox="0 0 24 24"
                  className="tm-star h-10 w-10 text-rc-rule transition-colors peer-focus-visible:rounded peer-focus-visible:ring-2 peer-focus-visible:ring-rc-brand"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 2.5l2.94 6.26 6.86.82-5.06 4.72 1.32 6.8L12 17.77 5.94 21.1l1.32-6.8L2.2 9.58l6.86-.82L12 2.5z"
                  />
                </svg>
              </label>
            ))}
          </div>
          {failed === 'rating' && <Err>{ERRORS.rating}</Err>}
        </fieldset>

        <div>
          <label
            htmlFor="tm-name"
            className="block font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute"
          >
            Your name
          </label>
          <p className="mt-1 text-xs text-rc-ink-mute">
            First name and last initial is plenty. Add your town if you like.
          </p>
          <input
            id="tm-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={NAME_MAX}
            defaultValue={draft.name}
            placeholder="Nick S., Tacoma"
            className="mt-2 w-full rounded-lg border border-rc-rule bg-rc-surface px-3.5 py-2.5 text-base text-rc-ink placeholder:text-rc-ink-mute/60 focus:border-rc-brand focus:outline-none"
          />
          {failed === 'name' && <Err>{ERRORS.name}</Err>}
        </div>

        <div>
          <label
            htmlFor="tm-body"
            className="block font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute"
          >
            Your testimonial
          </label>
          <textarea
            id="tm-body"
            name="body"
            rows={5}
            maxLength={BODY_MAX}
            defaultValue={draft.body}
            className="mt-2 w-full rounded-lg border border-rc-rule bg-rc-surface px-3.5 py-2.5 text-base text-rc-ink focus:border-rc-brand focus:outline-none"
          />
          {failed === 'body' && <Err>{ERRORS.body}</Err>}
        </div>

        {/* Honeypot: hidden from people, filled by scripts, dropped upstream. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="tm-website">Website</label>
          <input id="tm-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <p className="text-xs leading-relaxed text-rc-ink-mute">
          By sending this you are saying it is fine to quote you on the
          ReelCaster website, with the name you gave above. Email
          support@reelcaster.com any time to have it taken down.
        </p>

        {failed === 'send' && (
          <Err>Something went wrong sending that. Please try again.</Err>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-rc-brand px-4 py-3 text-sm font-semibold text-white hover:bg-rc-brand-hover transition-colors"
        >
          Send
        </button>
      </form>
    </article>
  );
}

/**
 * Stars fill from the left up to the picked one, and preview on hover.
 *
 * DOM order is 5..1, flipped back with flex-row-reverse, so a plain sibling
 * selector (~) reaches "this star and every star before it". While a star is
 * hovered only the hovered run is lit, so the pick and the preview never
 * fight; keyed on a hovered label, not the row, because the row is full width
 * and a mouse parked beside the stars would otherwise blank the pick. Plain
 * CSS because Tailwind cannot see selectors this long.
 */
const STAR_CSS = `
#tm .tm-stars label:hover .tm-star,
#tm .tm-stars label:hover ~ label .tm-star { color: #f59e0b; }
#tm .tm-stars:not(:has(label:hover)) input:checked + .tm-star,
#tm .tm-stars:not(:has(label:hover)) label:has(input:checked) ~ label .tm-star { color: #f59e0b; }
`;

async function save(formData: FormData): Promise<void> {
  'use server';
  const h = await headers();
  const name = String(formData.get('name') ?? '');
  const rating = Number(formData.get('rating')) || 0;
  const body = String(formData.get('body') ?? '');

  let field: TestimonialField | 'send' | null = null;
  try {
    const result = await submitTestimonial({
      name,
      rating,
      body,
      website: String(formData.get('website') ?? ''),
      context: {
        referer: h.get('referer'),
        user_agent: h.get('user-agent'),
        country: h.get('x-vercel-ip-country'),
        region: h.get('x-vercel-ip-country-region'),
      },
    });
    if (result.ok) redirect('/testimonials?saved=1');
    field = result.field ?? 'send';
  } catch (e) {
    // redirect() throws to unwind; let it through.
    if (e && typeof e === 'object' && 'digest' in e) throw e;
    field = 'send';
  }

  const q = new URLSearchParams({ e: field, name, rating: String(rating || ''), body });
  redirect(`/testimonials?${q.toString()}`);
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-rc-poor-ink">{children}</p>;
}
