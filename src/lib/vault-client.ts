/**
 * Pure HashiCorp Vault HTTP client — no framework/runtime coupling, so it is
 * unit-testable in plain Node. Mirrors the two API calls the runtime secrets
 * loader makes: JWT-auth login and a KV v2 read.
 *
 * Docs: https://developer.hashicorp.com/vault/api-docs/auth/jwt
 *       https://developer.hashicorp.com/vault/api-docs/secret/kv/kv-v2
 */

export interface VaultClientConfig {
  /** Base address, e.g. https://vault.reelcaster.com (no trailing slash). */
  addr: string;
  /** Mount path of the JWT/OIDC auth method. Default "jwt". */
  jwtMount?: string;
  /** Mount path of the KV v2 secrets engine. Default "secret". */
  kvMount?: string;
  /** Vault namespace (Enterprise / HCP Vault Dedicated, e.g. "admin"). */
  namespace?: string;
}

function nsHeaders(cfg: VaultClientConfig): Record<string, string> {
  return cfg.namespace ? { "x-vault-namespace": cfg.namespace } : {};
}

/**
 * Exchange a signed JWT (a Vercel OIDC token in prod) for a short-lived Vault
 * client token via the JWT auth method.
 */
export async function vaultJwtLogin(
  cfg: VaultClientConfig,
  role: string,
  jwt: string,
): Promise<string> {
  const mount = cfg.jwtMount ?? "jwt";
  const res = await fetch(`${cfg.addr}/v1/auth/${mount}/login`, {
    method: "POST",
    headers: { "content-type": "application/json", ...nsHeaders(cfg) },
    body: JSON.stringify({ role, jwt }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Vault JWT login failed (${res.status}): ${await safeText(res)}`,
    );
  }
  const json = (await res.json()) as { auth?: { client_token?: string } };
  const token = json.auth?.client_token;
  if (!token) throw new Error("Vault JWT login returned no client_token");
  return token;
}

/**
 * Read a KV v2 secret. KV v2 nests the secret map under `data.data`, which this
 * unwraps — callers get a flat `{ KEY: value }` map.
 */
export async function vaultKvRead(
  cfg: VaultClientConfig,
  token: string,
  path: string,
): Promise<Record<string, string>> {
  const mount = cfg.kvMount ?? "secret";
  const res = await fetch(`${cfg.addr}/v1/${mount}/data/${path}`, {
    headers: { "x-vault-token": token, ...nsHeaders(cfg) },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `Vault KV read failed (${res.status}): ${await safeText(res)}`,
    );
  }
  const json = (await res.json()) as {
    data?: { data?: Record<string, string> };
  };
  return json.data?.data ?? {};
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
