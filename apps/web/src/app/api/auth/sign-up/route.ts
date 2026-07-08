import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

const ROLE_HOME: Record<string, string> = {
  driver: "/driver",
  fleet_manager: "/fleet",
  caas: "/caas",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role") ?? "driver";
  const safeRole = role in ROLE_HOME ? role : "driver";
  const origin = url.origin;
  const returnTo = ROLE_HOME[safeRole];

  const signUpUrl = await getSignUpUrl({
    redirectUri: `${origin}/api/auth/callback`,
    returnTo,
    state: safeRole,
  });

  return redirect(signUpUrl);
}
