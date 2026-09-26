/**
 * Mint a refresh token on the Data Manager scope.
 *
 * Run:
 *   GOOGLE_DM_CLIENT_ID=... GOOGLE_DM_CLIENT_SECRET=... \
 *     node scripts/google-data-manager-token.mjs
 *
 * It starts a loopback server, prints a consent URL, waits for you to click
 * Allow in the browser you are already signed into, exchanges the code, and
 * prints the refresh token. Nothing is written anywhere: copy the token into
 * Vercel yourself.
 *
 * BEFORE THIS WORKS, in the Google Cloud console, on any project:
 *   1. APIs & Services → Library → enable "Data Manager API".
 *   2. APIs & Services → Credentials → Create credentials → OAuth client ID →
 *      application type **Desktop app**. That type is what makes the loopback
 *      redirect below legal; a "Web application" client would need its redirect
 *      URI registered by hand.
 *   3. If the consent screen is in Testing, add the Google account you will
 *      click Allow with as a test user. A refresh token minted under a Testing
 *      consent screen expires in 7 days, so publish the app once it works.
 *
 * Sign in as an account that is a user on the Google Ads account (Access and
 * security → Users). The Data Manager API checks that, not the developer token
 * the old Ads API upload needed — there isn't one here.
 *
 * WHY A SCRIPT RATHER THAN gcloud or a paste-the-code dance: the refresh token
 * is the one credential in this system that grants write access to the ad
 * account's conversion data, and this way it exists in exactly two places —
 * your terminal and Vercel — without passing through a chat transcript, a
 * shell history entry, or a file in the repo.
 */

import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/datamanager';
const PORT = Number(process.env.PORT ?? 8787);
const REDIRECT = `http://127.0.0.1:${PORT}`;

const clientId = process.env.GOOGLE_DM_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DM_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_DM_CLIENT_ID and GOOGLE_DM_CLIENT_SECRET first.');
  process.exit(1);
}

// Ties the callback to this run, so a stray request to the loopback port
// cannot feed us somebody else's code.
const state = randomBytes(16).toString('hex');

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    // offline + consent is what produces a REFRESH token rather than an access
    // token that dies in an hour. Without `prompt=consent` Google silently
    // omits the refresh token on every grant after the first, which reads as
    // "the script is broken" and is the single most common way this goes wrong.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

async function exchange(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`token exchange ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (!code && !error) {
    res.writeHead(404).end('waiting for the OAuth callback');
    return;
  }

  if (error || url.searchParams.get('state') !== state) {
    res.writeHead(400).end('Refused. Close this tab and run the script again.');
    console.error(error ? `Consent refused: ${error}` : 'State mismatch.');
    server.close();
    process.exit(1);
  }

  try {
    const token = await exchange(code);
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(
      'Done. The refresh token is in your terminal. You can close this tab.',
    );

    if (!token.refresh_token) {
      console.error(
        '\nGoogle returned no refresh_token. That happens when this account has\n' +
          'already granted this client: revoke it at\n' +
          'https://myaccount.google.com/permissions and run this again.\n',
      );
      process.exit(1);
    }

    const scopes = String(token.scope ?? '');
    console.log('\nRefresh token:\n');
    console.log(token.refresh_token);
    console.log('\nScopes granted:', scopes || '(none reported)');
    if (!scopes.includes('datamanager')) {
      console.warn(
        '\nWARNING: the datamanager scope is NOT in that list. A token without\n' +
          'it authenticates fine and then 403s on every upload.\n',
      );
    }
    console.log('\nNext:');
    console.log('  npx vercel env add GOOGLE_DM_REFRESH_TOKEN production --scope casey-1425s-projects');
    console.log('  (paste it when prompted, then repeat for preview if you want it there)\n');
  } catch (err) {
    res.writeHead(500).end('Exchange failed. See the terminal.');
    console.error(err);
    process.exit(1);
  }

  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nOpen this, sign in as a user on the Ads account, and click Allow:\n');
  console.log(authUrl);
  console.log(`\nListening on ${REDIRECT} for the callback...\n`);
});
