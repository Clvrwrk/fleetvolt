import { redirect } from "next/navigation";

// ── Phase 16 / Wave 6 / Task 6.2: Dead route cleanup ──────────────────────
//
// /network → redirect to /caas (the CaaS dashboard is the replacement)
// The old /network page used ScreenShell with a mock DC HTML file.
// It's now replaced by the role-gated CaaS dashboard at /caas.
//
// UX checks: NAV-3 (no dead links)

export default function NetworkPage() {
  redirect("/caas");
}
