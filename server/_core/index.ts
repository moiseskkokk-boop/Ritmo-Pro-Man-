import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getJwtSecret } from "./env";
import { finishWearableOAuth } from "../wearables";
import { ENV } from "./env";
import { MercadoPagoClient } from "../mercadopago";
import { processMercadoPagoWebhook } from "../mercadopago-service";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  getJwtSecret();
  const app = express();
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (ENV.isProduction && req.secure) res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    next();
  });
  const server = createServer(app);
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.post("/api/webhooks/mercadopago", express.json({ limit: "64kb" }), async (req, res) => {
    if (!ENV.mercadoPagoWebhookSecret || !ENV.mercadoPagoAccessToken) return res.status(503).json({ error: "Payment webhook is not configured" });
    try {
      const result = await processMercadoPagoWebhook({
        event: req.body && typeof req.body === "object" ? req.body : {},
        signature: req.header("x-signature"),
        requestId: req.header("x-request-id"),
        queryDataId: typeof req.query["data.id"] === "string" ? req.query["data.id"] : undefined,
        secret: ENV.mercadoPagoWebhookSecret,
        client: new MercadoPagoClient(),
      });
      return res.status(result.status).json({ received: result.ok, duplicate: "duplicate" in result ? result.duplicate : false });
    } catch {
      console.error("[MercadoPago] Webhook processing failed; provider may retry.");
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  // Other APIs accept larger JSON bodies for image analysis and uploads.
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api/trpc", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const origin = req.header("origin");
    if (req.method !== "GET" && origin) {
      const requestOrigin = req.protocol + "://" + req.get("host");
      if (origin !== requestOrigin) return res.status(403).json({ error: "Cross-origin request rejected" });
    }
    next();
  });
  app.get("/api/wearables/callback/:provider", async (req, res) => {
    const provider = req.params.provider;
    if (provider !== "google_health" && provider !== "garmin" && provider !== "coros") return res.status(404).send("Unknown wearable provider");
    let base = ENV.appPublicUrl;
    if (!base && provider === "google_health" && ENV.googleHealthRedirectUri) {
      try { base = new URL(ENV.googleHealthRedirectUri).origin; } catch { return res.status(503).send("OAuth callback is not configured."); }
    }
    if (!base) return res.status(503).send("OAuth callback is not configured.");
    try {
      if (typeof req.query.state !== "string" || typeof req.query.code !== "string") throw new Error("Missing OAuth response parameters");
      await finishWearableOAuth(provider, req.query.state, req.query.code);
      return res.redirect(303, `${base}/?wearable=${encodeURIComponent(provider)}-connected#dispositivos`);
    } catch {
      return res.redirect(303, `${base}/?wearable=authorization-error#dispositivos`);
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
