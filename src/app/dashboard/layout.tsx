import type { Metadata } from "next";

// dashboard/page.tsx is a client component and cannot export metadata itself,
// so the noindex lives here — same pattern as login/signup.
//
// This page answers 200 to an anonymous request (the auth gate runs in the
// browser), so without a robots directive it was indexable-by-default. It was
// kept out of the index only by the Disallow in robots.txt, and a Disallow
// stops crawling, not indexing: the homepage links here, so Google could still
// list the URL — and, being blocked, could never fetch the page to discover
// any directive saying otherwise. The noindex has to be readable to work.
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: true },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
