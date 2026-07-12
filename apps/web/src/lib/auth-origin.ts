/**
 * WorkOS requires an exact redirect URI. Next dev binds to 0.0.0.0 so other
 * devices can reach it, but 0.0.0.0 is not a browser-facing host and is not a
 * configured WorkOS redirect. Normalize only that bind address; preserve real
 * localhost, staging, preview, and production origins exactly.
 */
export function canonicalAuthOrigin(requestUrl: string): string {
  const url = new URL(requestUrl);
  if (url.hostname === "0.0.0.0") {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function configuredAuthRedirectUri(
  configuredRedirectUri: string | undefined,
  requestUrl: string,
): string {
  if (configuredRedirectUri?.trim()) return configuredRedirectUri.trim();
  return `${canonicalAuthOrigin(requestUrl)}/api/auth/callback`;
}

export function configuredAuthBaseUrl(
  configuredRedirectUri: string | undefined,
): string | undefined {
  if (!configuredRedirectUri?.trim()) return undefined;
  return canonicalAuthOrigin(configuredRedirectUri.trim());
}
