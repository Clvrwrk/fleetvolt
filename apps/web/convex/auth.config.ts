/**
 * Teach Convex how to validate WorkOS access tokens. Without these providers,
 * AuthKit can establish the browser session but every authenticated Convex
 * request is rejected with "No auth provider found matching the given token".
 */
const clientId = process.env.WORKOS_CLIENT_ID;
// WorkOS access-token `iss` is environment-scoped and can reference the
// environment's default application even when `client_id` names this app.
// Keep that routing value separate so staging/test applications validate the
// same session shape without pretending they share an application ID.
// The FleetVolt WorkOS environment currently issues User Management tokens
// from this environment-level client. It is intentionally not the FleetVolt
// application's client ID above. Keep the environment override for future
// rotation, but do not silently fall back to the application ID: that produces
// a provider which can never match the AuthKit token.
const DEFAULT_WORKOS_ISSUER_CLIENT_ID =
  "client_01KX0RP6HZNMC4A2JQ4XQV3KKP";
const issuerClientId =
  process.env.WORKOS_ISSUER_CLIENT_ID ?? DEFAULT_WORKOS_ISSUER_CLIENT_ID;

const authConfig = {
  providers: [
    {
      type: "customJwt" as const,
      issuer: "https://api.workos.com/",
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      applicationID: clientId,
    },
    {
      type: "customJwt" as const,
      issuer: `https://api.workos.com/user_management/${issuerClientId}`,
      algorithm: "RS256" as const,
      jwks: `https://api.workos.com/sso/jwks/${clientId}`,
    },
  ],
};

export default authConfig;
