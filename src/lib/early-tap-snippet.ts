/**
 * A tap on a trial button before React is live, kept instead of lost.
 *
 * The button is in the server HTML, so it paints long before the page
 * hydrates. On a slow phone that gap is seconds: the city ad page paints its
 * "Try Pro free" at ~1.4 s and hydrates at ~4.5 s (4x CPU, 1.6 Mbps), and
 * every tap in between did nothing. The flow loop of 2026-09-24 needed three
 * taps and 3.3 s to open the modal on every early walk; a real reader gets a
 * dead button and may not tap twice.
 *
 * Registered during head parse, so it is in place before the body paints.
 * A capture-phase click on anything carrying `data-early-tap` whose element
 * React has not yet claimed (see `useEarlyTap`, which sets `__rcLive` from a
 * ref) records that element's id on `window.__rcEarlyTap` and marks it
 * `data-early-tapped`, which globals.css draws as pressed, so the tap is seen
 * to have landed. The button's own hook opens the modal the moment it
 * hydrates. One pending tap at most: the last one wins.
 */
export const EARLY_TAP_SNIPPET = `(function(){try{document.addEventListener('click',function(e){var t=e.target,b=t&&t.closest&&t.closest('[data-early-tap]');if(!b||b.__rcLive)return;var p=document.querySelector('[data-early-tapped]');if(p)p.removeAttribute('data-early-tapped');window.__rcEarlyTap=b.getAttribute('data-early-tap');b.setAttribute('data-early-tapped','');},true)}catch(e){}})();`;
