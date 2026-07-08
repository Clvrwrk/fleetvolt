import { redirect } from "next/navigation";

export default function CaaSGapMapLauncherPage() {
  redirect("/workbench?mode=caas_gap_map");
}
