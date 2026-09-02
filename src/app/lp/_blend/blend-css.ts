import { LP8_CSS } from "../_city1/city1-css";

/**
 * The blend's stylesheet: /lp/seattle/1's sheet, plus an email form.
 *
 * Taken whole rather than forked. The hero on this page IS that hero, the
 * same nav, the same grey band, the same two-column grid, the same phone,
 * and a second copy of 567 lines describing it would be two files free to
 * disagree about a layout that took real work to settle (see the min-width:0
 * and the cqw notes in lp8-css.ts, both of which were paid for twice).
 *
 * What is NOT in here is anything for the live instrument in the middle of the
 * page. That block is deliberately rendered OUTSIDE the `.l8` wrapper, because
 * `.l8 h2` and `.l8 section` are element selectors: at (0,1,1) they outrank
 * every Tailwind utility the instrument styles its own headings and sections
 * with, and nesting it would silently restyle a component shared with the
 * public city page. The two bands meet without a seam because `--l8-bg` and
 * `--rc-bg` are the same #F5F6F7, which is a fact worth checking again if
 * either moves.
 */
export const BLEND_CSS = `${LP8_CSS}

/* ── The email ask, for the variant that makes one ────────────────────────
   Only the trial variants render this. An explore variant's hero has a link
   and nothing else, which is the whole difference being tested.

   Written here in the l8 vocabulary rather than reusing _shared/lp-css.ts's
   .lp-form: that sheet describes the 480px phone column the numbered variants
   run in, and this page injects only the one stylesheet above. */
.l8 .ask{max-width:min(420px,100%)}
@media(max-width:939px){.l8 .ask{margin-inline:auto}}
.l8 .asklab{
  display:block;font-family:var(--l8-mono);font-size:11px;font-weight:600;
  text-transform:uppercase;letter-spacing:.1em;color:var(--l8-ink-soft);
  margin:0 0 8px;text-align:left;
}
.l8 .askin{
  width:100%;height:52px;padding:0 16px;
  font-size:16px;font-weight:500;color:var(--l8-ink);
  background:var(--l8-panel);border:1px solid var(--l8-rule);border-radius:10px;
}
.l8 .askin::placeholder{color:var(--l8-ink-mute);font-weight:400}
.l8 .askin:focus-visible{outline:2px solid var(--l8-brand);outline-offset:1px;border-color:var(--l8-brand)}
.l8 .askin:disabled{opacity:.6}
/* Full width, unlike .go. A button beside an input it is the same width as
   reads as one control; a hug-content button under a full-width field reads
   as an afterthought. */
.l8 .ask .go{width:100%;justify-content:center;margin-top:10px;font-size:17px}
.l8 .ask .go[disabled]{opacity:.7;cursor:default}
/* The disclosure. Under the button, never further down the page: a
   card-required trial has to state the amount and the date beside the thing
   being pressed. Same rule the numbered variants follow. */
.l8 .askterms{
  font-family:var(--l8-mono);font-size:12px;line-height:1.65;
  color:var(--l8-ink-soft);margin:12px 0 0;text-align:left;
}
.l8 .askterms strong{color:var(--l8-ink);font-weight:600}
.l8 .askerr{
  font-size:13px;line-height:1.5;color:var(--l8-poor);margin:10px 0 0;text-align:left;
}
.l8 .askerr a{color:var(--l8-brand)}

/* The way past the card, on the trial variants only.
   A quiet text link, deliberately not a second button: two buttons of equal
   weight is not an ask with an escape hatch, it is a page that has not decided
   what it wants. Sits under the terms rather than beside the button so the
   reader meets the ask, the price and the date first, and finds this only if
   the ask was the thing stopping them.

   Left-aligned with the form above it, and held to the same 420px column, so
   a longer line wraps where .askterms wraps rather than running out past the
   field. The link sits OUTSIDE <form class="ask">, so it inherits none of that
   width on its own. */
.l8 .askalt{
  display:block;max-width:min(420px,100%);font-size:13px;line-height:1.5;
  color:var(--l8-ink-soft);margin:10px 0 0;text-align:left;
}
.l8 .askalt a{color:var(--l8-brand);text-decoration:underline;text-underline-offset:2px}
.l8 .askalt a:hover{color:var(--l8-ink)}

/* The close band runs the same form on navy. */
.l8 .close .ask{margin-inline:auto}
.l8 .close .asklab{color:#8FA3BC}
.l8 .close .askin{background:#fff;border-color:transparent}
.l8 .close .askterms{color:#8FA3BC}
.l8 .close .askterms strong{color:#fff}
/* Centred with the form, which the close band centres. --l8-brand is the blue
   this band sits on, so the link takes white instead. */
.l8 .close .askalt{margin-inline:auto;color:#8FA3BC}
.l8 .close .askalt a{color:#fff}
.l8 .close .askalt a:hover{color:#fff}
`;
