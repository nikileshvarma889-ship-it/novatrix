// Server-only configuration. Never import this from client components.
import "server-only";

const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable ${k} (see .env.example)`);
  return v;
};

export const env = {
  appName: process.env.APP_NAME || "Reelwise",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  databaseUrl: () => req("DATABASE_URL"),
  encryptionKey: () => req("ENCRYPTION_KEY"),
  storageDir: process.env.STORAGE_DIR || "./storage",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  meta: { appId: process.env.META_APP_ID || "", appSecret: process.env.META_APP_SECRET || "", version: process.env.META_GRAPH_VERSION || "v23.0" },
  google: { clientId: process.env.GOOGLE_CLIENT_ID || "", clientSecret: process.env.GOOGLE_CLIENT_SECRET || "" },
};

export const integrationStatus = () => ({
  meta: Boolean(env.meta.appId && env.meta.appSecret),
  google: Boolean(env.google.clientId && env.google.clientSecret),
  claudeServerKey: Boolean(env.anthropicKey),
});
