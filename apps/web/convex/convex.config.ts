// Convex app component registration (P12-04).
//
// Registers the @convex-dev/geospatial component (Beta) which provides the
// PostGIS-equivalent nearest()/query() surface for POINT datasets (chargers,
// carriers, parking, pois, ports). Downstream code NEVER imports this component
// directly — it goes through convex/lib/spatial.ts, which can swap to the
// hand-rolled haversine fallback behind FV_SPATIAL_BACKEND without touching
// callers (RESEARCH §1, T-12-02a).
import { defineApp } from "convex/server";
import geospatial from "@convex-dev/geospatial/convex.config";

const app = defineApp();
app.use(geospatial);

export default app;
