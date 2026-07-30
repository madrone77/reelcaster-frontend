'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Anchor, LifeBuoy } from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import ExploreTopBar from '@/app/explore/components/explore-top-bar';
import UnlockWithProCard from '@/app/components/paywall/unlock-with-pro-card';
import { SUPPORT_EMAIL } from '@/lib/site';

import type { SectionId } from './content';
import PortNav from './components/port-nav';
import PortSearch from './components/port-search';
import StartSection from './components/start-section';
import GuidesSection from './components/guides-section';
import AnswersSection from './components/answers-section';
import BillingSection from './components/billing-section';
import StatusSection from './components/status-section';
import TicketsSection from './components/tickets-section';

/**
 * The Port — the Pro-only support portal.
 *
 * Hard gate, three states:
 *   signed out  → redirect to /login?next=/support
 *   free tier   → paywall panel, with the public /faq + /contact routes offered
 *                 so nobody hits a dead end
 *   Pro         → the portal
 *
 * The gate here is UX only. Every read and write goes through
 * /api/support/tickets, which re-checks entitlement server-side.
 */
export default function SupportClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { isPaid, loading: subLoading } = useSubscription();

  const [section, setSection] = useState<SectionId>('start');
  /**
   * Set when arriving at a section from a search hit, so the target guide or
   * answer opens and scrolls itself into view instead of leaving the user to
   * hunt for the thing they just clicked.
   */
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login?next=/support');
  }, [authLoading, user, router]);

  const go = useCallback((next: SectionId, id?: string) => {
    setSection(next);
    setFocusId(id ?? null);
    // Sections swap in place below a fixed bar; without this a jump from the
    // bottom of Answers into Status lands you mid-page in the new section.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const body = useMemo(() => {
    switch (section) {
      case 'start':
        return <StartSection onNavigate={go} />;
      case 'guides':
        return <GuidesSection focusId={focusId} />;
      case 'answers':
        return <AnswersSection focusId={focusId} />;
      case 'billing':
        return <BillingSection />;
      case 'status':
        return <StatusSection focusId={focusId} />;
      case 'tickets':
        return <TicketsSection />;
    }
  }, [section, focusId, go]);

  // AuthGate already renders a full-screen spinner for the signed-out case;
  // rendering nothing here avoids a second competing loading state.
  if (authLoading || !user) return null;

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <PortHeader />

          {subLoading ? (
            <div className="mt-8 flex items-center gap-3 text-rc-ink-mute text-sm">
              <div className="animate-spin h-5 w-5 border-2 border-rc-brand border-t-transparent rounded-full" />
              Checking your membership…
            </div>
          ) : !isPaid ? (
            <ProGate />
          ) : (
            <>
              <div className="mt-6">
                <PortSearch onSelect={(hit) => go(hit.section, hit.id)} />
              </div>

              <div className="mt-8 lg:flex lg:gap-10 lg:items-start">
                <PortNav active={section} onSelect={(s) => go(s)} />
                <div className="flex-1 min-w-0 mt-6 lg:mt-0">{body}</div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function PortHeader() {
  return (
    <header>
      <div className="flex items-center gap-2 font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
        <Anchor className="w-3.5 h-3.5" aria-hidden />
        Pro member support
      </div>
      <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink">
        The Port
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-rc-ink-soft">
        Everywhere to get unstuck, in one place. Guides for the parts of
        ReelCaster that reward knowing them, straight answers to the questions
        we actually get, your billing, what is currently broken, and a direct
        line to us.
      </p>
    </header>
  );
}

/** Shown to signed-in members who are not on Pro. */
function ProGate() {
  return (
    <div className="mt-8 max-w-2xl">
      <div className="bg-rc-panel border border-rc-rule rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rc-brand-soft flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5 text-rc-brand" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-bold text-rc-ink">
              The Port is a Pro benefit
            </h2>
            <p className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
              Priority support · one business day
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-rc-ink-soft">
          Pro members get a direct support queue with a one business day reply
          target, a ticket history they can point back at, and the full guide
          library. Upgrading opens it immediately.
        </p>

        <div className="mt-6">
          <UnlockWithProCard
            theme="light"
            feature="support"
            headline="Open The Port"
            bullets={[
              'Priority support — one business day reply target',
              'Ticket history you can reference later',
              'Full guide library and searchable knowledge base',
              'Everything else Pro unlocks: 14-day forecast, 10 alerts, custom spots',
            ]}
          />
        </div>
      </div>

      {/* A hard gate with no exit is a dead end. Free members still need
          somewhere to go, so name the public routes explicitly. */}
      <div className="mt-6 bg-rc-surface border border-rc-rule rounded-xl p-5">
        <h3 className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
          Free support, still open
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
          You do not need Pro to get help. The{' '}
          <Link
            href="/faq"
            className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            FAQ
          </Link>{' '}
          covers the common questions, and{' '}
          <Link
            href="/contact"
            className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            Contact
          </Link>{' '}
          reaches the same people who answer Pro tickets — we just get to them
          in the order they arrive. Or email{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          directly.
        </p>
      </div>
    </div>
  );
}
