import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function MapTokenMissingBanner() {
  return (
    <Alert className="flex min-h-[360px] flex-col items-center justify-center border-[var(--fv-stroke)] bg-[var(--fv-surface)] text-foreground">
      <AlertTitle>Map unavailable</AlertTitle>
      <AlertDescription className="max-w-md text-center text-muted-foreground">
        Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment to view the route and
        charger map.
      </AlertDescription>
    </Alert>
  );
}
