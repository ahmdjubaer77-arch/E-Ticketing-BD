import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createAdminRouter } from "./admin/routes.js";
import { createAuthRouter } from "./auth/routes.js";
import { createNotificationRouter, createUserRouter } from "./users/routes.js";
import { createPublicHomeRouter } from "./public/home.js";
import { createPublicBookingsRouter } from "./public/bookings.js";
import { createPublicPaymentMethodsRouter } from "./public/payment-methods.js";
import { createTicketRouter } from "./tickets/routes.js";
import { createPublicSupportRouter } from "./public/support.js";

export function isAllowedOrigin(origin, config) {
  const allowedOrigins = new Set([config.clientUrl, config.adminClientUrl].filter(Boolean));
  if (!origin || allowedOrigins.has(origin)) return true;
  if (config.nodeEnv === "production") return false;

  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.origin === origin
      && parsedOrigin.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

export function createApp({ config, mailer }) {
  const app = express();

  if (config.nodeEnv === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin, config)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(
    "/api/public/bookings",
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "1mb" }),
  );
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use(cookieParser());
  app.use(
    "/api/admin",
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "2mb" }),
  );

  app.get("/api/health", (_request, response) => {
    response.json({ success: true, message: "API is available.", data: { service: "e-ticketing-api" } });
  });
  app.use(
    "/api/users/me/avatar",
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "400kb" }),
  );
  app.use("/api/users", createUserRouter({ config, mailer }));
  app.use("/api/notifications", createNotificationRouter(config));
  app.use("/api/auth", createAuthRouter({ config, mailer }));
  app.use("/api/tickets", createTicketRouter(config));
  app.use("/api/public/support", createPublicSupportRouter({ config, mailer }));
  app.use("/api/public", createPublicHomeRouter());
  app.use("/api/public/payment-methods", createPublicPaymentMethodsRouter());
  app.use("/api/public/bookings", createPublicBookingsRouter(config));
  app.use("/api/admin", createAdminRouter(config, mailer));
  app.use("/api", (_request, response) => {
    response.status(404).json({ success: false, message: "API endpoint not found." });
  });

  app.use((error, _request, response, _next) => {
    if (response.headersSent) return;
    if (Number.isInteger(error?.statusCode) && error.publicMessage) {
      response.status(error.statusCode).json({ success: false, message: error.publicMessage, code: error.code });
      return;
    }
    if (error?.type === "entity.too.large") {
      response.status(413).json({ success: false, message: "Request body is too large." });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ success: false, message: "Request body must be valid JSON." });
      return;
    }
    if (error?.message === "Origin is not allowed by CORS") {
      response.status(403).json({ success: false, message: "Request origin is not allowed." });
      return;
    }
    console.error("API request failed.");
    response.status(500).json({ success: false, message: "An unexpected server error occurred." });
  });

  return app;
}
