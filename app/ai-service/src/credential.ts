// Stores your Azure OpenAI key in the CaseDesk database, so the database can call the embedding model itself.
//   npm run credential                  the local database in .env (walkthrough step 6)
//   npm run credential -- <server-name>  the Azure database, signing in with Microsoft Entra ID (step 10)
// Reads the key with your az login and never prints it. The notebook creates the external model.

import { randomBytes } from "node:crypto";
import { DefaultAzureCredential } from "@azure/identity";
import { loadSettings } from "./config.js";
import { closePool, getPool } from "./db.js";

const ARM = "https://management.azure.com";
const azure = new DefaultAzureCredential();

interface CognitiveAccount {
  id: string;
  disableLocalAuth: boolean | null;
}

async function arm<T>(path: string, body?: unknown): Promise<T> {
  const { token } = await azure.getToken(`${ARM}/.default`);
  const response = await fetch(`${ARM}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Azure Resource Manager returned ${response.status} for ${path.split("?")[0]}.`);
  return (await response.json()) as T;
}

// One Azure Resource Graph query searches every subscription the sign-in can see.
async function findAccount(subdomain: string): Promise<CognitiveAccount> {
  const { data } = await arm<{ data: CognitiveAccount[] }>(
    "/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01",
    {
      query:
        "resources | where type =~ 'microsoft.cognitiveservices/accounts'" +
        ` | where tolower(tostring(properties.customSubDomainName)) == '${subdomain}'` +
        " | project id, disableLocalAuth = tobool(properties.disableLocalAuth)",
    },
  );
  if (!data[0]) throw new Error(`No Azure OpenAI resource named ${subdomain} in the subscriptions your az login can see.`);
  return data[0];
}

const serverArg = process.argv[2]?.trim() ?? "";
if (serverArg && !/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(serverArg)) {
  console.error("Usage: npm --prefix app/ai-service run credential [-- <server-name>]");
  process.exit(1);
}

const settings = loadSettings();
const sqlSettings = serverArg
  ? {
      ...settings.sql,
      server: serverArg.includes(".") ? serverArg : `${serverArg}.database.windows.net`,
      port: 1433,
      auth: "entra" as const,
      trustServerCertificate: false,
    }
  : settings.sql;

try {
  if (settings.ai.provider !== "azure") {
    throw new Error("The database calls Azure OpenAI. Set AI_PROVIDER=azure in .env (see step 6).");
  }
  const endpoint = new URL(settings.ai.azure.endpoint);
  const host = endpoint.hostname.toLowerCase();
  // The host is written into T-SQL below, so only a plain Azure OpenAI host name is accepted.
  if (endpoint.protocol !== "https:" || !/^[a-z0-9-]+\.(openai|cognitiveservices)\.azure\.com$/.test(host)) {
    throw new Error("AZURE_OPENAI_ENDPOINT must look like https://<resource>.openai.azure.com.");
  }
  const resource = host.split(".")[0]!;

  const pool = await getPool(sqlSettings).catch((error: unknown) => {
    if ((error as { code?: string }).code !== "ESOCKET") throw error;
    const hint = serverArg
      ? "Check the server name, and that the server firewall allows your IP address."
      : "Check that the container is running, and that SQL_PORT in .env matches its port (step 2).";
    throw new Error(`Can't reach ${sqlSettings.server}:${sqlSettings.port}. ${hint}`);
  });
  console.log(`Connected to ${sqlSettings.server}/${sqlSettings.database}.`);

  const account = await findAccount(resource);
  if (account.disableLocalAuth) {
    throw new Error("This Azure OpenAI resource has key access turned off, so the database can't use a key to call it.");
  }
  const { key1 } = await arm<{ key1: string }>(`${account.id}/listKeys?api-version=2024-10-01`);
  if (!/^[A-Za-z0-9]+$/.test(key1)) throw new Error("The resource returned a key in an unexpected format.");

  const credential = `https://${host}/`;
  // The database also protects its master key itself, so this password is never needed again.
  const masterKeyPassword = `Mk1-${randomBytes(24).toString("base64url")}`;

  await pool.request().batch(`
IF NOT EXISTS (SELECT 1 FROM sys.symmetric_keys WHERE name = N'##MS_DatabaseMasterKey##')
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = '${masterKeyPassword}';

IF EXISTS (SELECT 1 FROM sys.database_scoped_credentials WHERE name = N'${credential}')
    ALTER DATABASE SCOPED CREDENTIAL [${credential}]
        WITH IDENTITY = 'HTTPEndpointHeaders', SECRET = '{"api-key":"${key1}"}';
ELSE
    CREATE DATABASE SCOPED CREDENTIAL [${credential}]
        WITH IDENTITY = 'HTTPEndpointHeaders', SECRET = '{"api-key":"${key1}"}';`);

  console.log(`Stored the key in the database scoped credential [${credential}]. The key wasn't printed.`);
  console.log(`In the notebook, replace <your-resource> with: ${resource}`);
  if (settings.ai.azure.embeddingDeployment !== "text-embedding-3-small") {
    console.log(`Also replace text-embedding-3-small with: ${settings.ai.azure.embeddingDeployment}`);
  }
} catch (error) {
  console.error("Storing the key failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closePool();
}
