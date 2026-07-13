import assert from "node:assert/strict";
import test from "node:test";
import {
  browserRequestOrigin,
  canonicalAuthOrigin,
  configuredAuthBaseUrl,
  configuredAuthRedirectUri,
  loopbackAuthRedirectUrl,
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
    canonicalAuthOrigin("http://127.0.0.1:3100/api/auth/sign-in"),
    "http://localhost:3100",
  );
  assert.equal(
    canonicalAuthOrigin("https://staging.fleetvolt.network/api/auth/sign-up"),
    "https://staging.fleetvolt.network",
  );
});

test("redirects only noncanonical browser hosts onto the localhost cookie host", () => {
  assert.equal(
    loopbackAuthRedirectUrl(
      "http://0.0.0.0:3100/api/auth/sign-in?role=caas",
      "127.0.0.1:3100",
    ),
    "http://localhost:3100/api/auth/sign-in?role=caas",
  );
  assert.equal(
    loopbackAuthRedirectUrl(
      "http://0.0.0.0:3100/api/auth/sign-in?role=caas",
      "localhost:3100",
    ),
    null,
  );
  assert.equal(
    loopbackAuthRedirectUrl(
      "https://staging.fleetvolt.network/api/auth/sign-in?role=caas",
      "staging.fleetvolt.network",
    ),
    null,
  );
});

test("derives the browser-facing origin instead of the internal listener", () => {
  assert.equal(
    browserRequestOrigin(
      "http://0.0.0.0:3100/api/auth/callback?code=1",
      "localhost:3100",
      "http",
    ),
    "http://localhost:3100",
  );
  assert.equal(
    browserRequestOrigin(
      "http://0.0.0.0:3000/api/auth/callback?code=1",
      "staging.fleetvolt.network",
      "https",
    ),
    "https://staging.fleetvolt.network",
  );
});

test("keeps loopback callbacks on the initiating local instance", () => {
  const configured = "http://localhost:3000/api/auth/callback";
  assert.equal(
    configuredAuthRedirectUri(
      configured,
      "http://0.0.0.0:3000/api/auth/sign-up",
    ),
    configured,
  );
  assert.equal(
    configuredAuthRedirectUri(
      configured,
      "http://127.0.0.1:3100/api/auth/sign-in?role=caas",
    ),
    "http://localhost:3100/api/auth/callback",
  );
  assert.equal(configuredAuthBaseUrl(configured), "http://localhost:3000");
});
