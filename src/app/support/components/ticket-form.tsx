'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

import {
  BODY_MAX,
  BODY_MIN,
  SUBJECT_MAX,
  SUBJECT_MIN,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_HINTS,
  TICKET_CATEGORY_LABELS,
  type CreateTicketInput,
  type TicketCategory,
} from '@/lib/support-types';

interface Props {
  submitting: boolean;
  onSubmit: (input: CreateTicketInput) => Promise<boolean>;
}

/**
 * Ticket composer.
 *
 * Validation mirrors the API's bounds so the member finds out about a too-short
 * body while typing rather than after a round-trip. The server still enforces
 * them — this is a courtesy, not the gate.
 */
export default function TicketForm({ submitting, onSubmit }: Props) {
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);

  const subjectOk =
    subject.trim().length >= SUBJECT_MIN &&
    subject.trim().length <= SUBJECT_MAX;
  const bodyOk =
    body.trim().length >= BODY_MIN && body.trim().length <= BODY_MAX;
  const valid = !!category && subjectOk && bodyOk;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || submitting) return;

    const ok = await onSubmit({
      category: category as TicketCategory,
      subject: subject.trim(),
      body: body.trim(),
      // The page the member is on is genuinely useful for triage and costs
      // them nothing to provide. The API allowlists which context keys it
      // keeps, so this cannot be used to smuggle arbitrary fields.
      context: { page: window.location.pathname },
    });

    if (ok) {
      setCategory('');
      setSubject('');
      setBody('');
      setTouched(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-rc-panel border border-rc-rule rounded-xl p-5 sm:p-6"
    >
      <fieldset disabled={submitting} className="space-y-5">
        <div>
          <legend className="font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute">
            What is this about?
          </legend>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            {TICKET_CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <label
                  key={c}
                  className={`flex items-start gap-2.5 px-3.5 py-3 rounded-lg border cursor-pointer transition-colors ${
                    active
                      ? 'border-rc-brand bg-rc-brand-soft'
                      : 'border-rc-rule bg-rc-panel hover:bg-rc-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c}
                    checked={active}
                    onChange={() => setCategory(c)}
                    className="mt-1 accent-rc-brand"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-rc-ink">
                      {TICKET_CATEGORY_LABELS[c]}
                    </span>
                    <span className="block text-xs text-rc-ink-mute mt-0.5">
                      {TICKET_CATEGORY_HINTS[c]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {touched && !category && (
            <p className="mt-2 text-xs text-rc-poor-ink">Pick a category.</p>
          )}
        </div>

        <div>
          <label
            htmlFor="ticket-subject"
            className="block font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute"
          >
            Subject
          </label>
          <input
            id="ticket-subject"
            type="text"
            value={subject}
            maxLength={SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="One line. What would you title this?"
            className="mt-2 w-full bg-rc-page border border-rc-rule rounded-lg px-3.5 py-2.5 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:border-rc-brand focus:ring-[3px] focus:ring-rc-brand-soft2 transition-colors"
          />
          {touched && !subjectOk && (
            <p className="mt-2 text-xs text-rc-poor-ink">
              Give us at least {SUBJECT_MIN} characters.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label
              htmlFor="ticket-body"
              className="block font-rc-mono text-[10px] tracking-[0.12em] uppercase text-rc-ink-mute"
            >
              Details
            </label>
            <span
              className={`font-rc-mono text-[10px] ${
                body.length > BODY_MAX - 200
                  ? 'text-rc-poor-ink'
                  : 'text-rc-ink-mute'
              }`}
            >
              {body.length}/{BODY_MAX}
            </span>
          </div>
          <textarea
            id="ticket-body"
            value={body}
            rows={7}
            maxLength={BODY_MAX}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened, what you expected, and anything we can use to reproduce it: spot name or URL, species, time of day, device. The more specific, the faster this gets solved."
            className="mt-2 w-full bg-rc-page border border-rc-rule rounded-lg px-3.5 py-2.5 text-sm text-rc-ink placeholder:text-rc-ink-mute leading-relaxed focus:outline-none focus:border-rc-brand focus:ring-[3px] focus:ring-rc-brand-soft2 transition-colors resize-y"
          />
          {touched && !bodyOk && (
            <p className="mt-2 text-xs text-rc-poor-ink">
              Please give us at least {BODY_MIN} characters of detail.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-rc-ink-mute max-w-sm leading-relaxed">
            We attach your plan and browser automatically, so there is no need to include
            them.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden />
                Send to support
              </>
            )}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
