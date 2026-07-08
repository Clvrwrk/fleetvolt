import { httpRouter } from "convex/server";
import { authKit } from "./auth";

const http = httpRouter();

// WorkOS webhook handler — syncs user data (user.created/updated/deleted)
authKit.registerRoutes(http, {
  webhookSecret: process.env.WORKOS_WEBHOOK_SECRET,
});

export default http;
