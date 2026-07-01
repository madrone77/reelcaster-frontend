import "server-only";
import {
  vaultJwtLogin,
  vaultKvRead,
  type VaultClientConfig,
} from "./vault-client";

/**
 * Runtime server-secret loader.
 *
 * On Vercel (production/preview), each request carries a short-lived Vercel
 * OIDC token. This loader exchanges that token for a Vault token (JWT auth),
 * reads the KV v2 secret set, and caches it in-memory for the warm lambda
 * instance (default 5 min). When `VAULT_ADDR` is unset — local dev, tests, and
 * everything pre-migration — it falls back to `process.env`, so existing code
 * keeps working unchanged.
 *
 * Auth precedence: `VAULT_TOKEN` (a static token, for local dev / non-Vercel
 * runtimes) wins; otherwise the per-request Vercel OIDC token is used.
 *
 * NOTE: `@vercel/oidc`'s getVercelOidcToken() must run inside a request (the
 * token arrives as the `x-vercel-oidc-token` header), so any caller of
 * getServerSecret()/loadServerSecrets() must run in a request context, never at
 * module top-level.
 */

const ADDR = process.env.VAULT_ADDR;
const ROLE = process.env.VAULT_JWT_ROLE ?? "reelcaster-frontend";
const KV_PATH = process.env.VAULT_KV_PATH ?? "reelcaster-frontend";
const STATIC_TOKEN = process.env.VAULT_TOKEN;
const TTL_MS = Number(process.env.VAULT_CACHE_TTL_MS ?? 5 * 60_000);

const cfg: VaultClientConfig = {
  addr: ADDR ?? "",
  jwtMount: process.env.VAULT_JWT_MOUNT,
  kvMount: process.env.VAULT_KV_MOUNT,
  namespace: process.env.VAULT_NAMESPACE, // "admin" on HCP Vault Dedicated
};

type SecretMap = Record<string, string>;

let cache: { at: number; secrets: SecretMap } | null = null;
let inflight: Promise<SecretMap> | null = null;

/** Whether Vault is configured at all (else everything resolves from env). */
export function vaultConfigured(): boolean {
  return Boolean(ADDR);
}

async function vaultToken(): Promise<string> {
  if (STATIC_TOKEN) return STATIC_TOKEN;
  // Lazy import: only pull @vercel/oidc when an OIDC exchange is actually
  // needed, and keep this module importable where the token isn't present.
  const { getVercelOidcToken } = await import("@vercel/oidc");
  const jwt = await getVercelOidcToken();
  return vaultJwtLogin(cfg, ROLE, jwt);
}

async function fetchFromVault(): Promise<SecretMap> {
  const token = await vaultToken();
  return vaultKvRead(cfg, token, KV_PATH);
}

/** Load the full secret set (cached per warm instance). */
export async function loadServerSecrets(): Promise<SecretMap> {
  if (!ADDR) return process.env as SecretMap; // fallback: no Vault configured
  if (cache && Date.now() - cache.at < TTL_MS) return cache.secrets;
  if (inflight) return inflight; // dedupe concurrent cold-start loads
  inflight = (async () => {
    try {
      const secrets = await fetchFromVault();
      cache = { at: Date.now(), secrets };
      return secrets;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Resolve one secret and report where it came from. Prefers Vault when
 * configured and the key is present; otherwise falls back to `process.env`
 * (per-key), so a value missing from Vault still resolves during migration.
 */
export async function resolveSecret(
  name: string,
): Promise<{ value: string; source: "vault" | "env" }> {
  if (ADDR) {
    const secrets = await loadServerSecrets();
    const fromVault = secrets[name];
    if (fromVault != null && fromVault !== "") {
      return { value: fromVault, source: "vault" };
    }
  }
  const fromEnv = process.env[name];
  if (fromEnv != null && fromEnv !== "") {
    return { value: fromEnv, source: "env" };
  }
  throw new Error(`Missing secret: ${name}`);
}

/** Read one server secret by name. */
export async function getServerSecret(name: string): Promise<string> {
  return (await resolveSecret(name)).value;
}
