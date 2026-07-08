import { redirect } from "next/navigation";

export default function DriverDayPlanLauncherPage() {
  redirect("/workbench?mode=driver_day_plan");
}
