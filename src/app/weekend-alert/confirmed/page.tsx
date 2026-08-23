// Where the confirmation link lands. Deliberately plain, and deliberately a
// real page rather than a JSON 200: this is opened in a browser by somebody
// who just tapped a link in their inbox.

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekend report confirmed",
  robots: { index: false, follow: false },
};

export default async function Confirmed({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const ok = status === "confirmed";

  return (
    <main
      data-theme="rc-light"
      className="min-h-dvh bg-rc-page text-rc-ink font-rc-sans flex items-center justify-center px-6"
    >
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">
          {ok ? "You are on the list" : "That link has expired"}
        </h1>
        <p className="text-[15px] text-rc-ink-soft mt-3">
          {ok
            ? "Your first weekend report lands on Thursday afternoon."
            : "Confirmation links are replaced each time you sign up. Ask for a new one from your city page."}
        </p>
        <Link
          href="/fishing"
          className="inline-block mt-6 rounded-lg bg-rc-brand px-5 py-3 text-[15px] font-semibold text-white hover:bg-rc-brand-hover transition-colors"
        >
          Find your water
        </Link>
      </div>
    </main>
  );
}
