import Image from 'next/image';
import { Home, Map, NotebookPen, MoreHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The tab bar's four tabs, in MobileBottomNav's order, with Explore lit
 * because Explore is what the screen is showing. Same icons from the same
 * set: a hand-drawn approximation of the bar would be the picture disagreeing
 * with the app again, in the one place a reader can check it against the
 * screenshot in the App Store.
 */
const TABS: { label: string; Icon: LucideIcon; active?: boolean }[] = [
  { label: 'Home', Icon: Home },
  { label: 'Explore', Icon: Map, active: true },
  { label: 'Catch log', Icon: NotebookPen },
  { label: 'More', Icon: MoreHorizontal },
];

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
  width = 'w-[min(330px,88%)]',
}: {
  /** Fills the screen under the app bar. */
  children: ReactNode;
  /** What the whole device is a picture of, for a screen reader. */
  label: string;
  /**
   * The device's own width, as a utility class. Everything inside is a share
   * of it, so this is the only dial.
   *
   * The carousel passes `min(397px,100%)` to stand this phone beside the two
   * live ones from the landing pages, which are 397 because that is the width
   * at which a real 375px app screen fits inside a real bezel. Four screens
   * of one product in devices of three sizes reads as three products.
   */
  width?: string;
}) {
  return (
    <div
      className={`mx-auto flex flex-col ${width} [container-type:inline-size]`}
      role="group"
      aria-label={label}
    >
      <div className="flex flex-1 flex-col rounded-[13cqw] bg-[#0A0C10] p-[3cqw] shadow-[0_26px_54px_rgba(18,21,26,.26),0_2px_0_rgba(255,255,255,.14)_inset]">
        {/* 840 screen units is the device's own height, and it is a FLOOR
            rather than a fixed height so the frame can be stretched to match
            the phones beside it. The carousel does that: one of those phones
            lays its instrument out at a fixed size whatever width it is given,
            so below about 445px of window it is taller than this frame's
            proportion, and four devices in a row have to be one device. See
            SLOT_CSS in product-carousel.tsx. Given no such box, this is
            exactly the height it always was. */}
        <div className="relative min-h-[calc(840*var(--sp))] w-full flex-1 overflow-hidden rounded-[10cqw] bg-rc-brand [--sp:calc(94cqw/375)]">
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

            {/* The tab bar, floating over the map exactly as it does in the
                app: a detached pill inset 16 from the sides and 12 up from
                the bottom, 64 tall, 16 of radius, four columns. Icons at 20
                and labels at 10, which are MobileBottomNav's own numbers.

                It is inside the screen rather than beside it because it is
                part of the product being shown. Until it was here the phone
                was a map with a header, which is a website; the bar is what
                says this is an app you carry. */}
            <div
              aria-hidden
              className="absolute inset-x-[calc(16*var(--sp))] bottom-[calc(12*var(--sp))] grid h-[calc(64*var(--sp))] grid-cols-4 rounded-[calc(16*var(--sp))] border border-rc-rule bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md"
            >
              {TABS.map(({ label, Icon, active }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center justify-center gap-[calc(2*var(--sp))] ${
                    active ? 'text-rc-brand' : 'text-rc-ink-mute'
                  }`}
                >
                  <Icon
                    className="h-[calc(20*var(--sp))] w-[calc(20*var(--sp))]"
                    fill="none"
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span className="text-[calc(10*var(--sp))] font-medium tracking-[0.01em] whitespace-nowrap">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
