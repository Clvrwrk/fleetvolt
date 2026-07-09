import geospatial from "@convex-dev/geospatial/convex.config";
import workOSAuthKit from "@convex-dev/workos-authkit/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
// Point spatial index for chargers/carriers/parking/pois/ports (Phase 12).
// Without this, nearestPoints() throws "geospatial … Unmounted".
app.use(geospatial);
app.use(workOSAuthKit);
export default app;
