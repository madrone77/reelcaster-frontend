'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2 } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

type Result =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; status: 'active' | 'unsubscribed' | 'claimed'; spotName: string; spotSlug: string }
  | { kind: 'error'; message: string };

export default function AlertConfirmPanel({
  token,
  action,
}: {
  token: string;
  action: 'confirm' | 'unsubscribe';
}) {
  const [result, setResult] = useState<Result>(
    token ? { kind: 'idle' } : { kind: 'error', message: 'This link is missing its code.' },
  );

  const submit = async () => {
    setResult({ kind: 'busy' });
    try {
      const res = await fetch('/api/alert-leads/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ kind: 'error', message: "We couldn't find that alert. The link may be out of date." });
        return;
      }
      trackEvent('Alert Lead Action', { action, status: body.status });
      setResult({ kind: 'done', status: body.status, spotName: body.spot_name, spotSlug: body.spot_slug });
    } catch {
      setResult({ kind: 'error', message: 'Something went wrong. Try again.' });
    }
  };

  const heading =
    action === 'confirm' ? 'Switch on your alert' : 'Stop these alert emails';

  let content: React.ReactNode;
  if (result.kind === 'done') {
    const spotHref = `/explore/spot/${result.spotSlug}`;
    const signupHref = `/signup?next=${encodeURIComponent(spotHref)}`;
    if (result.status === 'active') {
      content = (
        <>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">You&apos;re set</h1>
          <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
            We&apos;ll email you when {result.spotName} is forecast to hit your score.
            Want alerts on more spots or species? Create a free account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href={signupHref}
              className="rounded-xl bg-rc-brand hover:bg-rc-brand-hover px-5 py-3 text-center text-sm font-semibold text-white transition-colors"
            >
              Create a free account
            </Link>
            <Link
              href={spotHref}
              className="rounded-xl border border-rc-rule px-5 py-3 text-center text-sm font-semibold text-rc-ink hover:bg-rc-surface transition-colors"
            >
              Back to {result.spotName}
            </Link>
          </div>
        </>
      );
    } else if (result.status === 'claimed') {
      content = (
        <>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">This alert is on your account</h1>
          <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
            Manage it from Notifications once you&apos;re signed in.
          </p>
          <Link
            href="/notifications"
            className="mt-6 block rounded-xl bg-rc-brand hover:bg-rc-brand-hover px-5 py-3 text-center text-sm font-semibold text-white transition-colors"
          >
            Go to Notifications
          </Link>
        </>
      );
    } else {
      content = (
        <>
          <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
            No more alert emails for {result.spotName}. You can set one up again from the spot page anytime.
          </p>
          <Link
            href={spotHref}
            className="mt-6 block rounded-xl border border-rc-rule px-5 py-3 text-center text-sm font-semibold text-rc-ink hover:bg-rc-surface transition-colors"
          >
            Back to {result.spotName}
          </Link>
        </>
      );
    }
  } else {
    content = (
      <>
        <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">{heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
          {action === 'confirm'
            ? 'Tap below and we’ll start watching the forecast for you.'
            : 'Tap below and we’ll stop emailing you about this spot.'}
        </p>
        {result.kind === 'error' && (
          <div className="mt-4 rounded-lg bg-rc-poor-bg px-3 py-2 text-sm text-rc-poor-ink">
            {result.message}
          </div>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!token || result.kind === 'busy'}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-rc-brand hover:bg-rc-brand-hover px-5 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
        >
          {result.kind === 'busy' && <Loader2 className="h-4 w-4 animate-spin" />}
          {action === 'confirm' ? 'Confirm my alert' : 'Unsubscribe'}
        </button>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-rc-brand text-white">
        <Bell className="h-5 w-5" />
      </div>
      {content}
    </div>
  );
}
