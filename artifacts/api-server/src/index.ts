import app from "./app";
import { logger } from "./lib/logger";
import { initStripe } from "./lib/stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run Stripe migrations + managed webhook setup before accepting traffic.
// initStripe internally swallows errors so server still starts if Stripe
// connection isn't ready yet (the developer can reconnect and restart).
await initStripe(logger);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
