import type { Metadata } from "next";
import CatchDetailShell from "./catch-detail-shell";

export const metadata: Metadata = {
  title: "Catch details · ReelCaster",
  robots: { index: false },
};

export default async function CatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CatchDetailShell catchId={id} />;
}
