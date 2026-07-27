import type { Metadata } from "next";

// login/page.tsx is a client component and cannot export metadata itself, so
// the noindex lives here. The page is a bare form with no unique content —
// indexed, it competes with nothing and dilutes the crawl budget that should
// go to spot and city pages.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
