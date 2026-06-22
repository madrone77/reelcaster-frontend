import Link from "next/link";
import { SUPPORT_EMAIL } from "./faq-data";

export function FaqOutro() {
  return (
    <>
      <section className="mt-14 rounded-3xl bg-rcc-brand px-6 py-10 text-center">
        <h2 className="text-2xl font-extrabold text-white">Still have a question?</h2>
        <p className="mx-auto mt-2 max-w-md text-white/80">
          If it&rsquo;s not answered here, we&rsquo;d love to hear it — we read every email.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/map"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-rcc-brand shadow-sm transition hover:bg-white/90"
          >
            Open the live map
          </Link>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm font-semibold text-white/90 underline underline-offset-4 hover:text-white"
          >
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      </section>

      <footer className="mt-12 flex items-center justify-between gap-4 border-t border-rcc-line pt-6 text-xs text-rcc-faint">
        <Link href="/map" className="hover:text-rcc-muted">
          ← Back to the map
        </Link>
        <span>© ReelCaster</span>
      </footer>
    </>
  );
}
