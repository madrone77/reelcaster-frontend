import type { Metadata } from "next";

// signup/page.tsx is a client component and cannot export metadata itself, so
// the noindex lives here. The page is a bare form with no unique content —
// indexed, it competes with nothing and dilutes the crawl budget that should
// go to spot and city pages.
export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: true },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
