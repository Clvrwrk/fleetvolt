import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import {
  configuredAuthRedirectUri,
  loopbackAuthRedirectUrl,
} from "@/lib/auth-origin";

const ROLE_HOME: Record<string, string> = {
  driver: "/driver",
  fleet_manager: "/fleet",
  caas: "/caas",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const canonicalRequestUrl = loopbackAuthRedirectUrl(
    request.url,
    request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  );
  if (canonicalRequestUrl) {
    // AuthKit stores its PKCE verifier on the host that starts sign-in. Force
    // 127.0.0.1/0.0.0.0 onto localhost before getSignInUrl creates the cookie,
    // because WorkOS returns to the configured localhost callback.
    return redirect(canonicalRequestUrl);
  }
  const role = url.searchParams.get("role") ?? "caas";
  const safeRole = role in ROLE_HOME ? role : "caas";
  const redirectUri = configuredAuthRedirectUri(
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    request.url,
  );

  const signInUrl = await getSignInUrl({
    redirectUri,
    returnTo: ROLE_HOME[safeRole],
    state: safeRole,
  });

  return redirect(signInUrl);
}
