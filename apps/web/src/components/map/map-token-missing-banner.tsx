import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Graceful fallback when the Google Maps key / vector Map ID is not configured
 * (mirrors pulse-map's MapUnavailable intent). Layout + Alert are unchanged so
 * existing test selectors and the graceful-degradation path are preserved.
 */
export function MapTokenMissingBanner() {
  return (
    <Alert className="flex min-h-[360px] flex-col items-center justify-center border-[var(--fv-stroke)] bg-[var(--fv-surface)] text-foreground">
      <AlertTitle>Map unavailable</AlertTitle>
      <AlertDescription className="max-w-md text-center text-muted-foreground">
        Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAP_ID (the
        vector Map ID) in your environment to view the route and charger map.
      </AlertDescription>
    </Alert>
  );
}
