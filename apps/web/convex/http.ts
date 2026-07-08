import { httpRouter } from "convex/server";
import { authKit } from "./auth";

const http = httpRouter();

// WorkOS webhook handler — syncs user data (user.created/updated/deleted)
// The webhook secret is read from the WORKOS_WEBHOOK_SECRET env var by the component.
authKit.registerRoutes(http);

export default http;
