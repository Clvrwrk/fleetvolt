import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalAuthOrigin,
  configuredAuthBaseUrl,
  configuredAuthRedirectUri,
} from "./auth-origin";

test("normalizes the Next dev bind address to the configured localhost host", () => {
  assert.equal(
    canonicalAuthOrigin("http://0.0.0.0:3000/api/auth/sign-up?role=caas"),
    "http://localhost:3000",
  );
});

test("preserves localhost and deployed origins", () => {
  assert.equal(
    canonicalAuthOrigin("http://localhost:3000/api/auth/sign-up"),
    "http://localhost:3000",
  );
  assert.equal(
    canonicalAuthOrigin("https://staging.fleetvolt.network/api/auth/sign-up"),
    "https://staging.fleetvolt.network",
  );
});

test("prefers the configured WorkOS redirect and derives its callback base", () => {
  const configured = "http://localhost:3000/api/auth/callback";
  assert.equal(
    configuredAuthRedirectUri(
      configured,
      "http://0.0.0.0:3000/api/auth/sign-up",
    ),
    configured,
  );
  assert.equal(configuredAuthBaseUrl(configured), "http://localhost:3000");
});
