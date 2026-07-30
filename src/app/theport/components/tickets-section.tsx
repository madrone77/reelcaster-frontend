'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Inbox, Mail } from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { SUPPORT_EMAIL } from '@/lib/site';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  type CreateTicketInput,
  type SupportTicket,
  type TicketStatus,
} from '@/lib/support-types';

import PortSection from './port-section';
import TicketForm from './ticket-form';

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: 'bg-rc-brand-soft text-rc-brand',
  in_progress: 'bg-rc-fair-bg text-rc-fair-ink',
  waiting_on_user: 'bg-rc-poor-bg text-rc-poor-ink',
  resolved: 'bg-rc-good-bg text-rc-good-ink',
  closed: 'bg-rc-surface text-rc-ink-mute',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface Banner {
  tone: 'success' | 'warn' | 'error';
  message: string;
}

export default function TicketsSection() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/support/tickets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load your tickets');
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      // Non-fatal: the history is a nicety, filing a new ticket is the job.
      // A red banner here would imply the form is broken when it is not.
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (input: CreateTicketInput): Promise<boolean> => {
    if (!token) {
      setBanner({ tone: 'error', message: 'Your session expired — sign in again.' });
      return false;
    }
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
      const data = await res.json();

      if (!res.ok) {
        setBanner({
          tone: 'error',
          message: data.error ?? 'Could not send your ticket. Please try again.',
        });
        return false;
      }

      setTickets((prev) => [data.ticket, ...prev]);
      setBanner(
        data.emailed
          ? {
              tone: 'success',
              message: `Ticket ${data.ticket.ticket_ref} is with us. Check your inbox for the confirmation — we reply within one business day.`,
            }
          : {
              // The row is saved either way; say exactly which half failed
              // rather than implying the whole thing did.
              tone: 'warn',
              message: `Ticket ${data.ticket.ticket_ref} is saved and in our queue, but the confirmation email did not send. Nothing is lost — we can still see it.`,
            },
      );
      return true;
    } catch {
      setBanner({
        tone: 'error',
        message: 'Network error — your ticket was not sent. Please try again.',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortSection
      eyebrow="Contact us"
      title="File a ticket"
      intro="A real person reads every one. Check Status first if something looks broken — if it is already listed, we know."
    >
      {banner && <BannerCard banner={banner} />}

      <TicketForm submitting={submitting} onSubmit={submit} />

      <div className="mt-10">
        <h3 className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
          Your tickets
        </h3>

        {loading ? (
          <div className="mt-3 flex items-center gap-3 text-sm text-rc-ink-mute">
            <div className="animate-spin h-4 w-4 border-2 border-rc-brand border-t-transparent rounded-full" />
            Loading…
          </div>
        ) : tickets.length === 0 ? (
          <div className="mt-3 bg-rc-panel border border-rc-rule rounded-xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rc-surface flex items-center justify-center mx-auto">
              <Inbox className="w-5 h-5 text-rc-ink-mute" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium text-rc-ink">
              Nothing filed yet
            </p>
            <p className="mt-1 text-sm text-rc-ink-mute max-w-sm mx-auto leading-relaxed">
              Anything you send appears here with its reference, so you can point
              back at it later.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="bg-rc-panel border border-rc-rule rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-rc-mono text-[11px] font-bold text-rc-ink">
                        {t.ticket_ref}
                      </span>
                      <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                        {TICKET_CATEGORY_LABELS[t.category] ?? t.category}
                        {' · '}
                        {formatDate(t.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-rc-ink">
                      {t.subject}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-rc-mono text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded ${
                      STATUS_CLASS[t.status] ?? STATUS_CLASS.open
                    }`}
                  >
                    {TICKET_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>

                <p className="mt-2.5 text-sm text-rc-ink-soft leading-relaxed whitespace-pre-wrap">
                  {t.body}
                </p>

                {t.resolution_note && (
                  <div className="mt-3 bg-rc-good-bg border border-rc-good-border rounded-lg px-4 py-3">
                    <p className="font-rc-mono text-[9px] tracking-[0.12em] uppercase text-rc-good-ink">
                      Our reply
                    </p>
                    <p className="mt-1 text-sm text-rc-good-ink leading-relaxed whitespace-pre-wrap">
                      {t.resolution_note}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2.5 text-xs text-rc-ink-mute leading-relaxed">
        <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
        <p>
          Prefer email? Write to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          from your account address and it reaches the same queue. Replying to a
          confirmation email with its <code>RC-</code> reference in the subject
          threads onto that ticket.
        </p>
      </div>
    </PortSection>
  );
}

function BannerCard({ banner }: { banner: Banner }) {
  const style =
    banner.tone === 'success'
      ? 'bg-rc-good-bg border-rc-good-border text-rc-good-ink'
      : banner.tone === 'warn'
        ? 'bg-rc-fair-bg border-rc-fair-border text-rc-fair-ink'
        : 'bg-rc-poor-bg border-rc-poor/40 text-rc-poor-ink';
  const Icon = banner.tone === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div
      role="status"
      className={`mb-5 flex items-start gap-2.5 border rounded-lg px-4 py-3 text-sm leading-relaxed ${style}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <p>{banner.message}</p>
    </div>
  );
}
