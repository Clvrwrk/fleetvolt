import { redirect } from "next/navigation";

/** Legacy launcher — CaaS map now lives at /caas (freight overview first). */
export default function CaaSGapMapLauncherPage() {
  redirect("/caas");
}
