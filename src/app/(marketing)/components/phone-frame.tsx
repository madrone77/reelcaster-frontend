import Image from 'next/image';
import type { ReactNode } from 'react';

/**
 * The product on an iPhone: a portrait device shell with the Explore top bar,
 * and whatever it is handed filling the screen below.
 *
 * This is the same phone /lp/1's hero reel draws, down to the numbers — the
 * bezel, the two concentric radii, the dynamic island, the 116/724 split of
 * the screen. See `_city1/city1-css.ts`. Two mocks of the same device that
 * disagree about its proportions read as two different products, so when one
 * of these changes the other has to change with it.
 *
 * ── Everything is sized off one unit ─────────────────────────────────────
 *
 * `--sp` is a pixel of a 375-wide phone screen expressed as a share of the
 * device's width, so every number below can be read straight off the design.
 * The container query lives on the outer element and `--sp` is read by its
 * DESCENDANTS: an element cannot query its own size, and a `cqw` written on
 * the container itself silently falls back to the viewport — which turns a
 * radius meant to be 40px into one wider than the phone.
 *
 * The screen is a real box of real pixels, not a scaled-down 375 design, so a
 * live map inside it lays out at the size it is actually given. What the frame
 * fixes is the shape, which is the part that has to be an iPhone.
 */
export default function PhoneFrame({
  children,
  label,
}: {
  /** Fills the screen under the app bar. */
  children: ReactNode;
  /** What the whole device is a picture of, for a screen reader. */
  label: string;
}) {
  return (
    <div
      className="mx-auto w-[min(330px,88%)] [container-type:inline-size]"
      role="group"
      aria-label={label}
    >
      <div className="rounded-[13cqw] bg-[#0A0C10] p-[3cqw] shadow-[0_26px_54px_rgba(18,21,26,.26),0_2px_0_rgba(255,255,255,.14)_inset]">
        <div className="relative h-[calc(840*var(--sp))] w-full overflow-hidden rounded-[10cqw] bg-rc-brand [--sp:calc(94cqw/375)]">
          {/* The app bar, at ExploreTopBar's own measurements taken at 375px:
              64 tall over a 52 status strip, 16 of side padding, a 104x48
              mark, a 40-tall CTA. Anything invented here is the picture
              disagreeing with the screen it claims to be of.

              An anonymous visitor really does get this bar on a phone — it is
              hidden for Pro subscribers only — so the mock is not flattering
              itself by showing the offer. */}
          <div className="absolute inset-x-0 top-0 flex h-[calc(116*var(--sp))] items-center justify-between bg-rc-brand pt-[calc(52*var(--sp))] pr-[calc(16*var(--sp))] pl-[calc(16*var(--sp))] text-white">
            {/* The dynamic island, drawn rather than screenshotted: it stays
                sharp at any width, and the phone avoids claiming a clock or a
                battery level we would then have to keep honest. */}
            <div className="absolute top-[calc(12*var(--sp))] left-1/2 h-[calc(28*var(--sp))] w-[calc(96*var(--sp))] -translate-x-1/2 rounded-full bg-[#0A0C10]" />
            {/* White-on-brand mark: this strip is the brand blue, and the blue
                knockout would put a blue box on a blue bar. */}
            <Image
              src="/reelcaster-mark-white.svg"
              alt=""
              width={104}
              height={48}
              className="block h-[calc(48*var(--sp))] w-auto"
            />
            {/* Sentence case in the markup, uppercased in CSS, as the real
                button is: a screen reader should hear the product's label. */}
            <span className="inline-flex h-[calc(40*var(--sp))] items-center rounded-[calc(4*var(--sp))] bg-white px-[calc(16*var(--sp))] text-[calc(12*var(--sp))] font-bold tracking-[calc(.3*var(--sp))] whitespace-nowrap text-rc-brand uppercase">
              Start free trial
            </span>
          </div>

          <div className="absolute inset-x-0 top-[calc(116*var(--sp))] bottom-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
