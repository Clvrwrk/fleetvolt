import { redirect } from "next/navigation";

// ── Phase 16 / Wave 6 / Task 6.2: Dead route cleanup ──────────────────────
//
// /pulse → redirect to /caas
// The old /pulse page was a legacy freight pulse visualization with complex
// dependencies (gsap, Google Maps, Radix) that is not in any role's sidebar nav.
// The CaaS dashboard now provides the primary analytics view for CaaS users.
// This redirect prevents the broken loading behavior and dead-end route.
//
// UX checks: NAV-3 (no dead links)

export default function PulsePage() {
  redirect("/caas");
}
