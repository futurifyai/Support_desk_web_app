const MIN_SESSION_SECRET_LENGTH = 32;

export function getSessionSecret(): string {
  const secret = process.env["SESSION_SECRET"]?.trim();
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured before starting the API server");
  }
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return secret;
}

export function getTrustedProxyHops(): number {
  const configured = process.env["TRUST_PROXY_HOPS"];
  if (configured === undefined || configured === "") {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("TRUST_PROXY_HOPS must be configured in production");
    }
    return 0;
  }
  if (!/^\d+$/.test(configured)) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
  }
  const hops = Number(configured);
  if (!Number.isSafeInteger(hops) || hops > 5) {
    throw new Error("TRUST_PROXY_HOPS must be between 0 and 5");
  }
  return hops;
}