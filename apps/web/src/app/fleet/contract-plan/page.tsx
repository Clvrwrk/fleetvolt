import { redirect } from "next/navigation";

export default function FleetContractPlanLauncherPage() {
  redirect("/workbench?mode=fleet_contract_plan");
}
