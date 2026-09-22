import Image from 'next/image';

/**
 * The ReelCaster Pro look: the box mark with a gold plus hung off the L.
 *
 * Gold only ever sits on brand blue. `reelcaster-mark-pro.svg` carries its
 * own blue fill for that reason, and both lockups below sit on a blue plate,
 * so they hold up on the white bar as well as the brand bar (where the plate
 * simply disappears into the bar).
 *
 * - `ProHeaderMark`: the header mark for a Pro account (paid, trialing, or
 *   comped). Mark plus a gold PRO badge.
 * - `ProLockup`: marketing headings. Mark plus "ReelCaster Pro" in words,
 *   because a plus on its own reads as "Plus", and the plan is called Pro.
 */

export function ProHeaderMark() {
  return (
    <span className="flex items-center gap-2 rounded-[4px] bg-rc-brand py-1 pl-1 pr-2">
      <Image src="/reelcaster-mark-pro.svg" alt="ReelCaster Pro" width={104} height={48} priority />
      <span
        aria-hidden
        className="rounded-[3px] bg-rc-pro-gold px-1.5 py-0.5 text-[11px] font-black leading-none tracking-[0.12em] text-rc-brand"
      >
        PRO
      </span>
    </span>
  );
}

export function ProLockup({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div
      className={`inline-flex items-center whitespace-nowrap rounded-lg bg-rc-brand ${
        lg ? 'gap-3 px-3 py-2.5 lg:gap-5 lg:px-5 lg:py-4' : 'gap-3 px-3 py-2.5'
      }`}
    >
      <Image
        src="/reelcaster-mark-pro.svg"
        alt=""
        width={lg ? 130 : 104}
        height={lg ? 60 : 48}
        className={lg ? 'h-10 w-auto lg:h-[60px]' : 'h-10 w-auto'}
      />
      <span
        className={`font-black leading-none tracking-[-0.02em] text-white ${
          lg ? 'text-xl lg:text-4xl' : 'text-xl'
        }`}
      >
        ReelCaster <span className="text-rc-pro-gold">Pro</span>
      </span>
    </div>
  );
}
