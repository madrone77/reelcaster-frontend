/**
 * On-screen client error capture, opt-in via `?diag=1`.
 *
 * A visitor reported that a spot page painted and then, about a second later,
 * blanked to Next's generic "Application error: a client-side exception has
 * occurred" — the signature of a throw during hydration. That message carries
 * no detail, and the device was a phone, so there was no console to read. Every
 * diagnosis attempt from a developer machine reproduced nothing, because the
 * trigger is something about *that* visitor's device, network, or account.
 *
 * This installs `error` / `unhandledrejection` listeners and, when the URL
 * carries `?diag=1`, paints the message + stack + environment into a plain DOM
 * node appended to `<body>`. The node lives outside React's root container on
 * purpose: when the root error boundary tears the tree down, anything React
 * owns disappears with it, and the report has to outlive that.
 *
 * It also POSTs the first error to `/api/client-error` so the stack lands in
 * the server logs even if the visitor only says "still broken". Both the
 * overlay and the POST are gated on `?diag=1` — this is a debugging aid aimed
 * at one reproduction, not always-on telemetry.
 *
 * Emitted as a raw inline `<script>` in `<head>` rather than a React component:
 * a component's effect runs after its subtree hydrates, which is exactly when
 * the error we are chasing fires, and `next/script`'s `beforeInteractive` does
 * not hoist in the App Router. Registering during head parse gets the listener
 * in place before the bundles finish executing.
 *
 * ES5 only — it runs ahead of Next's polyfill chunk.
 */
export const CLIENT_DIAG_SNIPPET = `(function () {
  try {
    if (window.location.search.indexOf('diag=1') === -1) return;
  } catch (e) { return; }

  var seen = [];
  var posted = false;

  function env() {
    var bits = [];
    bits.push('url: ' + location.href);
    bits.push('ua: ' + navigator.userAgent);
    try { bits.push('lang: ' + navigator.language + ' | langs: ' + (navigator.languages || []).join(',')); } catch (e) {}
    try { bits.push('tz: ' + Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { bits.push('tz: <threw>'); }
    try { bits.push('screen: ' + screen.width + 'x' + screen.height + ' dpr=' + window.devicePixelRatio); } catch (e) {}
    try { bits.push('storage: ' + (window.localStorage ? 'ok' : 'missing')); } catch (e) { bits.push('storage: THREW ' + e); }
    try { bits.push('cookies: ' + navigator.cookieEnabled); } catch (e) {}
    try { bits.push('ResizeObserver: ' + (typeof ResizeObserver)); } catch (e) {}
    try { bits.push('memory: ' + (navigator.deviceMemory || '?') + ' cores: ' + (navigator.hardwareConcurrency || '?')); } catch (e) {}
    return bits.join('\\n');
  }

  function render() {
    var id = 'rc-diag-overlay';
    var box = document.getElementById(id);
    if (!box) {
      box = document.createElement('div');
      box.id = id;
      box.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'background:#fff', 'color:#111', 'overflow:auto',
        'padding:16px', 'font:12px/1.45 ui-monospace,Menlo,monospace',
        '-webkit-user-select:text', 'user-select:text'
      ].join(';'));
      (document.body || document.documentElement).appendChild(box);
    }
    var html = '<div style="font:600 15px system-ui;margin-bottom:10px">ReelCaster diagnostics</div>';
    html += '<div style="white-space:pre-wrap;background:#f4f4f5;padding:10px;border-radius:6px;margin-bottom:12px">' + esc(env()) + '</div>';
    for (var i = 0; i < seen.length; i++) {
      html += '<div style="white-space:pre-wrap;background:#fee;border:1px solid #f99;padding:10px;border-radius:6px;margin-bottom:10px">'
            + '<b>' + esc(seen[i].kind) + '</b>\\n' + esc(seen[i].message) + '\\n\\n' + esc(seen[i].stack || '(no stack)') + '</div>';
    }
    box.innerHTML = html;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function record(kind, message, stack) {
    seen.push({ kind: kind, message: String(message), stack: stack ? String(stack) : '' });
    try { render(); } catch (e) {}
    if (posted) return;
    posted = true;
    try {
      var body = JSON.stringify({ kind: kind, message: String(message), stack: stack ? String(stack) : '', env: env() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }));
      } else {
        var x = new XMLHttpRequest();
        x.open('POST', '/api/client-error', true);
        x.setRequestHeader('Content-Type', 'application/json');
        x.send(body);
      }
    } catch (e) {}
  }

  window.addEventListener('error', function (e) {
    record('window.error', (e && e.message) || 'unknown', e && e.error && e.error.stack);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    record('unhandledrejection', (r && r.message) || String(r), r && r.stack);
  });

  // Next's error boundary swaps the page out without necessarily raising a new
  // error, so also poll for the generic message and report what we captured.
  var ticks = 0;
  var iv = setInterval(function () {
    ticks++;
    if (ticks > 40) { clearInterval(iv); return; }
    try {
      if (document.body && document.body.innerText.indexOf('Application error') !== -1) {
        clearInterval(iv);
        if (!seen.length) record('boundary', 'Root error boundary replaced the page (no JS error captured)', '');
        else render();
      }
    } catch (e) {}
  }, 250);
})();`
