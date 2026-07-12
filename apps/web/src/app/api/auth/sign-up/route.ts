import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { configuredAuthRedirectUri } from "@/lib/auth-origin";

const ROLE_HOME: Record<string, string> = {
  driver: "/driver",
  fleet_manager: "/fleet",
  caas: "/caas",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role") ?? "driver";
  const safeRole = role in ROLE_HOME ? role : "driver";
  const redirectUri = configuredAuthRedirectUri(
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    request.url,
  );
  const returnTo = ROLE_HOME[safeRole];

  const signUpUrl = await getSignUpUrl({
    redirectUri,
    returnTo,
    state: safeRole,
  });

  return redirect(signUpUrl);
}
