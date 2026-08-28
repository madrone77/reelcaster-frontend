// Weekend Bite Alert emails: the confirmation, and the Thursday digest.
//
// Plain, narrow, and readable in a preview pane. No images: these go to cold
// leads whose clients block remote content by default, and a card that is
// blank until images load is a card nobody reads.

const WRAP =
  'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;' +
  "max-width:560px;margin:0 auto;padding:24px;color:#16202c;line-height:1.55";

const MUTED = "color:#5c6b7a;font-size:13px";
const BUTTON =
  "display:inline-block;background:#1F40E0;color:#ffffff;text-decoration:none;" +
  "padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px";

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function weekendAlertConfirmEmail(opts: {
  cityName: string;
  confirmUrl: string;
}): { subject: string; html: string } {
  const city = escape(opts.cityName);
  return {
    subject: `Confirm your ${city} weekend fishing report`,
    html: `<div style="${WRAP}">
  <p style="font-size:17px;font-weight:600;margin:0 0 12px">One tap and you are on the list.</p>
  <p style="margin:0 0 20px">Confirm this address and we will send you the ${city} weekend fishing report every Thursday afternoon: the windows, the water that is scoring, and anything the regulator has changed.</p>
  <p style="margin:0 0 24px"><a href="${escape(opts.confirmUrl)}" style="${BUTTON}">Confirm and start receiving it</a></p>
  <p style="${MUTED};margin:0">If you did not ask for this, ignore this email and nothing will be sent.</p>
</div>`,
  };
}

export interface WeekendDigestSpot {
  name: string;
  score: number;
  window: string | null;
  url: string;
}

export function weekendDigestEmail(opts: {
  cityName: string;
  verdictLine: string;
  speciesName: string | null;
  spots: WeekendDigestSpot[];
  aheadLine: string | null;
  cityUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const city = escape(opts.cityName);
  const rows = opts.spots
    .map(
      (s) => `  <tr>
    <td style="padding:8px 0;border-bottom:1px solid #e6eaef">
      <a href="${escape(s.url)}" style="color:#16202c;text-decoration:none;font-weight:600">${escape(s.name)}</a>
      ${s.window ? `<div style="${MUTED}">Good ${escape(s.window)}</div>` : ""}
    </td>
    <td style="padding:8px 0;border-bottom:1px solid #e6eaef;text-align:right;font-weight:700;font-size:17px">${s.score}</td>
  </tr>`,
    )
    .join("\n");

  return {
    subject: opts.speciesName
      ? `${city} weekend: ${escape(opts.verdictLine)}`
      : `${city} weekend fishing report`,
    html: `<div style="${WRAP}">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;${MUTED};margin:0 0 6px">${city} weekend report</p>
  <p style="font-size:19px;font-weight:700;margin:0 0 16px">${escape(opts.verdictLine)}</p>
  ${
    rows
      ? `<table style="width:100%;border-collapse:collapse;margin:0 0 18px">${rows}</table>`
      : ""
  }
  ${opts.aheadLine ? `<p style="margin:0 0 18px">${escape(opts.aheadLine)}</p>` : ""}
  <p style="margin:0 0 24px"><a href="${escape(opts.cityUrl)}" style="${BUTTON}">See every spot and hour</a></p>
  <p style="${MUTED};margin:0">You are getting this because you asked for the ${city} weekend report. <a href="${escape(opts.unsubscribeUrl)}" style="color:#5c6b7a">Unsubscribe</a>.</p>
</div>`,
  };
}
