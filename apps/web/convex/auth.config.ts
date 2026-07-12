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
const issuerClientId = process.env.WORKOS_ISSUER_CLIENT_ID ?? clientId;

export default {
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
