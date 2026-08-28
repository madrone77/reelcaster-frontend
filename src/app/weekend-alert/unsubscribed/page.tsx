import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

export default function Unsubscribed() {
  return (
    <main
      data-theme="rc-light"
      className="min-h-dvh bg-rc-page text-rc-ink font-rc-sans flex items-center justify-center px-6"
    >
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Unsubscribed</h1>
        <p className="text-[15px] text-rc-ink-soft mt-3">
          That was the last one. No further weekend reports will be sent.
        </p>
        <Link
          href="/fishing"
          className="inline-block mt-6 rounded-lg border border-rc-rule px-5 py-3 text-[15px] font-medium text-rc-ink hover:border-rc-brand transition-colors"
        >
          Back to the map
        </Link>
      </div>
    </main>
  );
}
