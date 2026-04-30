// Stripe client for the CareVoy api-server.
// Credentials are fetched from the Replit Stripe connector (no env-var keys).
// Never cache the client object — tokens expire. Always call getUncachableStripeClient().
import Stripe from "stripe";

interface ConnectionSettings {
  settings: {
    publishable: string;
    secret: string;
  };
}

async function getCredentials(): Promise<{
  publishableKey: string;
  secretKey: string;
}> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }
  if (!hostname) {
    throw new Error("REPLIT_CONNECTORS_HOSTNAME not set");
  }

  const isProduction = process.env["REPLIT_DEPLOYMENT"] === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as { items?: ConnectionSettings[] };
  const conn = data.items?.[0];

  if (!conn || !conn.settings.publishable || !conn.settings.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: conn.settings.publishable,
    secretKey: conn.settings.secret,
  };
}

// Always call fresh — never cache.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

// StripeSync singleton for webhook processing and data sync to local PG.
let stripeSync: unknown = null;

export async function getStripeSync(): Promise<{
  findOrCreateManagedWebhook: (url: string) => Promise<{ id: string }>;
  syncBackfill: () => Promise<unknown>;
  processWebhook: (body: Buffer, signature: string) => Promise<void>;
}> {
  if (!stripeSync) {
    const mod = (await import("stripe-replit-sync")) as {
      StripeSync: new (opts: {
        poolConfig: { connectionString: string; max: number };
        stripeSecretKey: string;
      }) => unknown;
    };
    const secretKey = await getStripeSecretKey();
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) throw new Error("DATABASE_URL required for StripeSync");
    stripeSync = new mod.StripeSync({
      poolConfig: { connectionString: databaseUrl, max: 2 },
      stripeSecretKey: secretKey,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stripeSync as any;
}

let initialized = false;

export async function initStripe(logger: {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}): Promise<void> {
  if (initialized) return;
  try {
    const { runMigrations } = (await import("stripe-replit-sync")) as {
      runMigrations: (opts: { databaseUrl: string }) => Promise<void>;
    };
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      logger.warn({}, "DATABASE_URL not set — skipping Stripe init");
      return;
    }
    await runMigrations({ databaseUrl });

    const sync = await getStripeSync();

    const replitDomains = process.env["REPLIT_DOMAINS"];
    if (replitDomains) {
      const firstDomain = replitDomains.split(",")[0]?.trim();
      if (firstDomain) {
        const webhookUrl = `https://${firstDomain}/api/stripe/webhook`;
        try {
          const webhook = await sync.findOrCreateManagedWebhook(webhookUrl);
          logger.info(
            { webhookId: webhook.id, webhookUrl },
            "Stripe managed webhook ready",
          );
        } catch (err) {
          logger.warn(
            { err: String(err) },
            "Could not set up managed webhook (continuing)",
          );
        }
      }
    }

    try {
      await sync.syncBackfill();
      logger.info({}, "Stripe backfill complete");
    } catch (err) {
      logger.warn(
        { err: String(err) },
        "Stripe backfill failed (continuing)",
      );
    }

    initialized = true;
  } catch (err) {
    logger.error({ err: String(err) }, "Stripe init failed");
  }
}
