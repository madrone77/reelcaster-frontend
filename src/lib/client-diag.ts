/**
 * On-screen client error capture, opt-in via `?diag=1`.
 *
 * A visitor's spot page paints and then, about a second later, blanks to Next's
 * generic "Application error: a client-side exception has occurred" — a throw
 * during hydration. It reproduces on their phone in both Safari and Chrome, in
 * normal mode, on current iOS, and reproduces on no developer machine.
 *
 * The first version of this reported the error itself, which established that
 * React was aborting hydration with #418 ("text content did not match") and
 * then dying on a RangeError. That was not enough to fix it: production React
 * strips the offending strings from #418, so the code says *that* text
 * mismatched but never *which* text. Two fixes were shipped against reproduced
 * guesses and neither fixed this visitor.
 *
 * So this version reports the mismatch itself. It re-fetches the page HTML —
 * the same server-rendered markup React hydrated against — and diffs its text
 * against the live DOM. The lines that differ are the hydration mismatch,
 * named, from the affected device.
 *
 * Every report also carries the build it came from. Correlating a screenshot's
 * clock against a deploy time already produced one wrong conclusion; the build
 * id removes the guesswork.
 *
 * The overlay is a plain DOM node appended to <body>, outside React's root
 * container, because the root error boundary tears down anything React owns.
 *
 * Emitted as a raw inline <script> in <head>: a React component's effect runs
 * after its subtree hydrates, which is exactly when the error fires, and
 * next/script's beforeInteractive does not hoist in the App Router.
 *
 * Entirely inert without `?diag=1` — no listeners, no overlay, no network.
 * ES5, since it runs ahead of Next's polyfill chunk.
 */
export function clientDiagSnippet(buildId: string): string {
  return `(function () {
  try {
    if (window.location.search.indexOf('diag=1') === -1) return;
  } catch (e) { return; }

  var BUILD = ${JSON.stringify(buildId)};
  var seen = [];
  var diffLines = null;
  var earlyText = '';
  var posted = false;

  function env() {
    var bits = [];
    bits.push('build: ' + BUILD);
    bits.push('loaded: ' + new Date().toISOString());
    bits.push('url: ' + location.href);
    bits.push('ua: ' + navigator.userAgent);
    try { bits.push('lang: ' + navigator.language + ' | langs: ' + (navigator.languages || []).join(',')); } catch (e) {}
    try { bits.push('tz: ' + Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (e) { bits.push('tz: <threw>'); }
    try { bits.push('offset: ' + new Date().getTimezoneOffset()); } catch (e) {}
    try { bits.push('screen: ' + screen.width + 'x' + screen.height + ' dpr=' + window.devicePixelRatio); } catch (e) {}
    try { bits.push('storage: ' + (window.localStorage ? 'ok' : 'missing')); } catch (e) { bits.push('storage: THREW ' + e); }
    try { bits.push('cookies: ' + navigator.cookieEnabled); } catch (e) {}
    try { bits.push('cores: ' + (navigator.hardwareConcurrency || '?')); } catch (e) {}
    return bits.join('\\n');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Every visible text node under \`root\`, trimmed.
   *
   * Node-level rather than innerText: a re-fetched document is parsed but never
   * laid out, so it has no innerText at all and textContent collapses the whole
   * page into one unbroken string — nothing the live DOM could be aligned
   * against. Walking text nodes gives both sides the same granularity, so a
   * difference points at one string instead of the whole page.
   */
  function textPieces(root) {
    var out = [];
    try {
      var doc = root.ownerDocument || document;
      var w = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = w.nextNode())) {
        var tag = n.parentNode && n.parentNode.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue;
        var s = String(n.nodeValue || '').replace(/^\\s+|\\s+$/g, '');
        if (s) out.push(s);
      }
    } catch (e) {}
    return out;
  }

  /**
   * Re-fetch the server HTML and diff its text against the live DOM.
   * Whatever differs is what React could not reconcile.
   */
  function computeDiff(done) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', location.href, true);
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        try {
          var doc = new DOMParser().parseFromString(x.responseText, 'text/html');
          // A parsed-but-not-rendered document has no innerText, so the
          // textContent fallback would otherwise fold in every <script> body —
          // the JSON-LD blocks alone swamp the diff.
          var drop = doc.querySelectorAll('script,style,noscript,template');
          for (var d = 0; d < drop.length; d++) {
            if (drop[d].parentNode) drop[d].parentNode.removeChild(drop[d]);
          }
          var serverLines = textPieces(doc.body);
          var clientLines = textPieces(document.body);
          var inClient = {}, inServer = {};
          var i;
          for (i = 0; i < clientLines.length; i++) inClient[clientLines[i]] = 1;
          for (i = 0; i < serverLines.length; i++) inServer[serverLines[i]] = 1;
          var onlyServer = [], onlyClient = [];
          for (i = 0; i < serverLines.length; i++) {
            if (!inClient[serverLines[i]] && onlyServer.length < 25) onlyServer.push(serverLines[i]);
          }
          for (i = 0; i < clientLines.length; i++) {
            if (!inServer[clientLines[i]] && onlyClient.length < 25) onlyClient.push(clientLines[i]);
          }
          diffLines = {
            cacheAge: x.getResponseHeader('age'),
            cacheState: x.getResponseHeader('x-vercel-cache'),
            edge: x.getResponseHeader('x-vercel-id'),
            onlyServer: onlyServer,
            onlyClient: onlyClient
          };
        } catch (e) {
          diffLines = { error: String(e) };
        }
        done();
      };
      x.send();
    } catch (e) {
      diffLines = { error: String(e) };
      done();
    }
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
    var html = '<div style="font:600 15px system-ui;margin-bottom:10px">ReelCaster diagnostics · build ' + esc(BUILD) + '</div>';
    html += '<div style="white-space:pre-wrap;background:#f4f4f5;padding:10px;border-radius:6px;margin-bottom:12px">' + esc(env()) + '</div>';

    if (diffLines) {
      html += '<div style="font:600 14px system-ui;margin:14px 0 6px">HYDRATION DIFF</div>';
      if (diffLines.error) {
        html += '<div style="background:#f4f4f5;padding:10px;border-radius:6px">could not diff: ' + esc(diffLines.error) + '</div>';
      } else {
        html += '<div style="background:#f4f4f5;padding:8px;border-radius:6px;margin-bottom:8px">cache ' +
          esc(diffLines.cacheState) + ' age=' + esc(diffLines.cacheAge) + '\\n' + esc(diffLines.edge) + '</div>';
        html += '<div style="white-space:pre-wrap;background:#eef6ff;border:1px solid #9cf;padding:10px;border-radius:6px;margin-bottom:8px"><b>SERVER only (' +
          diffLines.onlyServer.length + ')</b>\\n' + esc(diffLines.onlyServer.join('\\n')) + '</div>';
        html += '<div style="white-space:pre-wrap;background:#eeffee;border:1px solid #9c9;padding:10px;border-radius:6px;margin-bottom:8px"><b>CLIENT only (' +
          diffLines.onlyClient.length + ')</b>\\n' + esc(diffLines.onlyClient.join('\\n')) + '</div>';
      }
    }

    html += '<div style="font:600 14px system-ui;margin:14px 0 6px">ERRORS (' + seen.length + ')</div>';
    for (var i = 0; i < seen.length; i++) {
      html += '<div style="white-space:pre-wrap;background:#fee;border:1px solid #f99;padding:10px;border-radius:6px;margin-bottom:10px">'
            + '<b>' + esc(seen[i].kind) + '</b>\\n' + esc(seen[i].message) + '\\n\\n' + esc(seen[i].stack || '(no stack)') + '</div>';
    }
    box.innerHTML = html;
  }

  /** Post everything captured so far — all errors, plus the diff. */
  function post() {
    try {
      var body = JSON.stringify({
        build: BUILD,
        env: env(),
        errors: seen,
        diff: diffLines
      });
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

  function record(kind, message, stack) {
    seen.push({ kind: kind, message: String(message), stack: stack ? String(stack) : '' });
    try { render(); } catch (e) {}
  }

  window.addEventListener('error', function (e) {
    record('window.error', (e && e.message) || 'unknown', e && e.error && e.error.stack);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    record('unhandledrejection', (r && r.message) || String(r), r && r.stack);
  });

  document.addEventListener('DOMContentLoaded', function () {
    try { earlyText = document.body.innerText; } catch (e) {}
  });

  // Give hydration time to fail, then diff and report once. Runs whether or not
  // an error fired — a clean load is itself a useful data point.
  setTimeout(function () {
    computeDiff(function () {
      try { render(); } catch (e) {}
      if (!posted) { posted = true; post(); }
    });
  }, 6000);
})();`
}
