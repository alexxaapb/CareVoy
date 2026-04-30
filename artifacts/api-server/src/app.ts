import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Stripe webhook MUST be registered with raw body BEFORE express.json().
// stripe-replit-sync verifies the signature against the raw bytes and updates
// the local `stripe` schema tables.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const signature = req.headers["stripe-signature"];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!sig) {
      res.status(400).json({ error: "missing_signature" });
      return;
    }

    void (async () => {
      try {
        const sync = await getStripeSync();
        await sync.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (err) {
        req.log.error({ err: String(err) }, "stripe webhook processing failed");
        res.status(500).json({ error: "webhook_failed" });
      }
    })();
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
