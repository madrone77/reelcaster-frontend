import type { Metadata } from 'next';

import ExploreTopBar from '@/app/explore/components/explore-top-bar';
import AlertConfirmPanel from './alert-confirm-panel';

export const metadata: Metadata = {
  title: 'Confirm your alert',
  robots: { index: false, follow: false },
};

/**
 * /alert-confirm?token=…&action=confirm|unsubscribe
 *
 * Where a signed-out visitor's alert emails link to. The page asks for one tap
 * rather than acting on load, because mail scanners open links too. Public:
 * listed in AuthGate's PUBLIC_PREFIXES.
 */
export default async function AlertConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : '';
  const action = params.action === 'unsubscribe' ? 'unsubscribe' : 'confirm';

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="mx-auto max-w-md px-6 py-16">
          <AlertConfirmPanel token={token} action={action} />
        </div>
      </main>
    </div>
  );
}
