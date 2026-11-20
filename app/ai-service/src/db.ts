import sql from "mssql";
import type { Settings } from "./config.js";

let poolPromise: Promise<sql.ConnectionPool> | undefined;

function toConfig(settings: Settings["sql"]): sql.config {
  const base: sql.config = {
    server: settings.server,
    port: settings.port,
    database: settings.database,
    options: { encrypt: true, trustServerCertificate: settings.trustServerCertificate },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    // A free-offer database that auto-paused can take up to a minute to resume on first connect.
    connectionTimeout: 60_000,
    requestTimeout: 30_000,
  };

  if (settings.auth === "entra") {
    // Uses your `az login` locally and a managed identity when hosted. No password anywhere.
    return { ...base, authentication: { type: "azure-active-directory-default", options: {} } };
  }
  return { ...base, user: settings.user, password: settings.password };
}

/** Returns the single process-wide pool, reconnecting on the next call if the last attempt failed. */
export function getPool(settings: Settings["sql"]): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(toConfig(settings)).connect().catch((error: unknown) => {
      poolPromise = undefined;
      throw error;
    });
  }
  return poolPromise;
}

export async function closePool(): Promise<void> {
  const pending = poolPromise;
  poolPromise = undefined;
  if (pending) await (await pending).close();
}
