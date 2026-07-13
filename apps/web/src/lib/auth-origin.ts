/**
 * WorkOS requires an exact redirect URI. Next dev binds to 0.0.0.0 so other
 * devices can reach it, but 0.0.0.0 is not a browser-facing host and is not a
 * configured WorkOS redirect. Normalize only that bind address; preserve real
 * localhost, staging, preview, and production origins exactly.
 */
export function canonicalAuthOrigin(requestUrl: string): string {
  const url = new URL(requestUrl);
  if (url.hostname === "0.0.0.0" || url.hostname === "127.0.0.1") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function loopbackAuthRedirectUrl(
  requestUrl: string,
  hostHeader: string | null,
): string | null {
  if (!hostHeader) return null;
  const hostUrl = new URL(`http://${hostHeader}`);
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "0.0.0.0") {
    return null;
  }

  const canonical = new URL(requestUrl);
  canonical.host = hostHeader;
  canonical.hostname = "localhost";
  return canonical.toString();
}

export function browserRequestOrigin(
  requestUrl: string,
  hostHeader: string | null,
  protocolHeader?: string | null,
): string {
  const request = new URL(requestUrl);
  const protocol = protocolHeader
    ? (protocolHeader.endsWith(":") ? protocolHeader : `${protocolHeader}:`)
    : request.protocol;
  const host = hostHeader ?? request.host;
  return canonicalAuthOrigin(`${protocol}//${host}`);
}

export function configuredAuthRedirectUri(
  configuredRedirectUri: string | undefined,
  requestUrl: string,
): string {
  const requestOrigin = canonicalAuthOrigin(requestUrl);
  if (!configuredRedirectUri?.trim()) {
    return `${requestOrigin}/api/auth/callback`;
  }

  const configured = new URL(configuredRedirectUri.trim());
  const request = new URL(requestUrl);
  const requestIsLoopback = ["0.0.0.0", "127.0.0.1", "localhost"].includes(
    request.hostname,
  );
  const configuredIsLoopback = ["0.0.0.0", "127.0.0.1", "localhost"].includes(
    configured.hostname,
  );

  // Multiple local FleetVolt review instances run on distinct ports. Never
  // send a 3100 sign-in callback into the unrelated app on configured port
  // 3000; keep loopback auth bound to the initiating instance.
  if (requestIsLoopback && configuredIsLoopback) {
    return `${requestOrigin}/api/auth/callback`;
  }

  return configured.toString();
}

export function configuredAuthBaseUrl(
  configuredRedirectUri: string | undefined,
): string | undefined {
  if (!configuredRedirectUri?.trim()) return undefined;
  return canonicalAuthOrigin(configuredRedirectUri.trim());
}
