# Troubleshooting

[Overview](README.md)

Find the step where you got stuck, then the message or symptom you see. Each fix returns you to the same step.

## Coming back after a break

Closing VS Code stops the frontend and the AI service. Restarting your computer also stops the database container and Data API builder. Start what you need, in this order:

1. **Database:** start Docker Desktop. If **CaseDesk (local)** appears disconnected in **Connections**, right-click it and select **Start SQL Container**.
2. **API (from step 5):** if `/api/accounts` doesn't respond, right-click **CaseDesk**, select **Build Data API...**, open the deployment's **Deployment actions** menu, and select **Restart**.
3. **Frontend:** in a terminal, run `npm --prefix app/frontend run dev`.
4. **Ollama (from step 6):** start the Ollama app if you use it.
5. **AI service (from step 7):** in another terminal, run `npm --prefix app/ai-service run dev`, or `run dev:cloud` if you pointed it at Azure.
6. **Hosted API (Going further):** get a fresh token and restart the frontend as in [Use the hosted API from the app](going-further.md#use-the-hosted-api-from-the-app).

For Copilot prompts, start a new chat from **Connections** with **Open in GitHub Copilot Agent**.

## Step 0: Setup

| Symptom | Fix |
| --- | --- |
| **MS SQL: Open Getting Started** isn't in the Command Palette, or **Getting Started** has no **Create** menu | Update the MSSQL extension to the latest version and reload VS Code. |
| Copilot's **Agent** mode or tools aren't available, or VS Code shows **Restricted Mode** | Trust the folder: run **Workspaces: Manage Workspace Trust** from the Command Palette and select **Trust**. |
| `node`, `az`, or `ollama` is not recognized in a VS Code terminal | VS Code was open when you installed the tool, so its terminals can't find it yet. Close all VS Code windows and reopen VS Code. For `ollama`, you can instead use a PowerShell window from the Start menu. |

## Step 1: Frontend local settings

| Symptom | Fix |
| --- | --- |
| `app/frontend/.env.local` or `app/ai-service/.env` doesn't exist | Run the two settings lines from [Task 0.2](00-setup.md#task-02-get-the-code). They create whichever file is missing and keep the other. |
| The frontend reports that its port is already in use | Change `DEV_SERVER_PORT` in `app/frontend/.env.local` to a free port, then run the frontend again. Open the **Local** URL it prints. |
| Changes to local settings aren't taking effect | Edit `app/frontend/.env.local`, not the example file or the repository root. Stop the frontend with **Ctrl+C** and restart it. A value already set in the terminal takes precedence; open a fresh terminal if an old override is no longer needed. |
| `VITE_DATA_SOURCE must be sample or dab` | Set `VITE_DATA_SOURCE=sample` before the API step, or `VITE_DATA_SOURCE=dab` when the API is ready. Restart the frontend. |
| `DEV_SERVER_PORT must be a whole number between 1 and 65535` | Enter a valid port number in the frontend's local settings, with no URL or decimals. |
| `DAB_URL` or `AI_SERVICE_URL` must be an absolute URL | Include `http://` or `https://`, the host, and your service's port, for example `http://127.0.0.1:5001`. |

## Step 2: Local database

| Symptom | Fix |
| --- | --- |
| The wizard reports that the port is in use | Another program uses port 1433. Under **Advanced Options**, choose another port, such as `14333`, and set the same value as `SQL_PORT` in `app/ai-service/.env` in [Task 2.2](02-local-database.md#task-22-save-the-password-for-the-app). |
| The wizard says the container engine isn't running | Start Docker Desktop, wait until it reports that it's running, then select **Create Container** again. |
| Copilot says it can't find a connection | Expand **CaseDesk (local)** in **Connections** so it connects, then open **Open in GitHub Copilot Agent** from that connection and paste the prompt again. |

## Steps 3 and 4: Schema and data

| Symptom | Fix |
| --- | --- |
| Tables aren't visible in Object Explorer | Under **CaseDesk (local) > Databases > CaseDesk**, right-click **Tables** and select **Refresh**. If they still don't appear, ask Copilot to confirm that it created them in the `CaseDesk` database. |
| `Connect to the CaseDesk database, not master.` | The query editor is connected to `master`. Use **Change Database (MSSQL)** in the editor title bar to select `CaseDesk`, or set the connection's database as in step 2. |
| The seed fails with `Invalid column name` or `Cannot insert the value NULL` | Copilot's tables differ from the spec. Start over from the reference tables, as the tip at the end of [step 3](03-schema.md) describes, then run the seed again. |

## Step 5: Data API

| Symptom | Fix |
| --- | --- |
| The **Deploy** dialog reports that port 5000 is in use | Enter another port, such as `5001`, and use it in `DAB_URL`. On macOS, AirPlay Receiver often uses port 5000. |
| The app shows **Cases could not be refreshed** | Open `/api/accounts` at the API address in `app/frontend/.env.local`. Make sure Data API builder is running there and `DAB_URL` matches, then restart the frontend. After a computer restart, see [Coming back after a break](#coming-back-after-a-break). |
| The API's `/api/accounts` endpoint returns an error | Reopen **Build Data API...**, check that `accounts` and `support_cases` are enabled with **Read**, and deploy again. Use the actual API port, not necessarily 5000. |
| The app still shows **Hardcoded sample data** after the API starts | Set `VITE_DATA_SOURCE=dab` in `app/frontend/.env.local` and restart the frontend. |

## Step 6: AI setup and vector search

| Symptom | Fix |
| --- | --- |
| `Sign in first with: az login` from the Azure OpenAI script | Run `az login`. If you have several subscriptions, select one with `az account set --subscription <name-or-id>`, then run the script again. |
| `RequestDisallowedByPolicy` when a resource group is created, asking for a tag | Your subscription requires that tag on new resource groups. Run the Azure OpenAI script again with it, for example `-Tags Owner=<your-alias>`. When you host the API, tell Copilot the tag to add. |
| The script fails while deploying a model, mentioning quota, capacity, or an unavailable model | That region can't host the model for your subscription. Run the script again with another region and a new resource group, for example `-Location swedencentral -ResourceGroup rg-casedesk-ai-2`, and delete the first resource group. |
| The script says a model is deprecated or not available to new customers | Azure retires older models on a [schedule](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule). Pick a current chat model there and pass it to the script, for example `-ChatModel <name> -ChatModelVersion <version>`. |
| The script fails at the role assignment with `AuthorizationFailed` | Your account can create resources but not grant access. Ask an Owner of the resource group to give you **Cognitive Services OpenAI User** on the Azure OpenAI resource. |
| `Missing setting SQL_PASSWORD. Copy .env.example to .env and fill it in.` | Put the container password between the single quotes of `SQL_PASSWORD` in `app/ai-service/.env`, as in [Task 2.2](02-local-database.md#task-22-save-the-password-for-the-app). |
| `Login failed for user 'sa'` | The password in `.env` doesn't match the container password. Check that it's between single quotes, `SQL_PASSWORD='...'`; without them, everything from a `#` onward is ignored. If the container uses a port other than 1433, check `SQL_PORT`. |
| Azure OpenAI returns `401` or `403`, or `PermissionDenied` | The role assignment hasn't applied yet; wait a few minutes. Make sure `az login` uses the same account that ran the setup script. |
| The Azure OpenAI script warns that you can't assign roles (`AuthorizationFailed` on `roleAssignments/write`) | The resource, models, and settings are ready, but you need an administrator to grant access. Ask a subscription **Owner** or **User Access Administrator** to run the `az role assignment create` command the script printed. If your organization uses Privileged Identity Management, you can instead activate one of those roles and run the script again; it reuses what it already created. |
| Azure OpenAI returns `DeploymentNotFound` | The deployment names in `.env` must match the deployments in your resource exactly. |
| `fetch failed` or `ECONNREFUSED` with Ollama | Start Ollama and check that `ollama list` shows both models. |
| `The embedding model returned ... dimensions; the database column is VECTOR(768).` | `.env` names a different embedding model. Use `text-embedding-3-small` for Azure OpenAI or `nomic-embed-text` for Ollama. |
| `Failed to connect to localhost:1433 - Could not connect (sequence)`, or `Can't reach localhost:1433` | The command can't reach the database container. Start it as in [Coming back after a break](#coming-back-after-a-break). If it's running, check its port: run `docker ps`, and in a line like `0.0.0.0:1435->1433/tcp`, the first number is the port. Set `SQL_PORT` in `app/ai-service/.env` to it, as in [Task 2.2](02-local-database.md#task-22-save-the-password-for-the-app). |
| `No embedding for KB-2` or `No embedding found` | The articles have no embeddings yet. Complete [task 6.3](06-vector-search.md#task-63-generate-the-embeddings) for your path, then run the SQL again. |
| `The database calls Azure OpenAI. Set AI_PROVIDER=azure in .env` from `credential` | The `credential` command is for the Azure OpenAI path. With Ollama, follow the Ollama path in task 6.3 instead. |
| `No Azure OpenAI resource named ...` from `credential` | `az login` uses an account that can't see the resource in `AZURE_OPENAI_ENDPOINT`. Sign in with the account you used for the Azure OpenAI setup. |
| `Azure Resource Manager returned 403` for `listKeys` | You can't read the resource's keys. Ask for **Cognitive Services Contributor** on the Azure OpenAI resource, or ask someone who has it to run the command. |
| `This Azure OpenAI resource has key access turned off` | Your organization turned off keys on the resource, so the database can't use one. Run `npm --prefix app/ai-service run embed` instead, which signs in with Microsoft Entra ID, and skip the notebook's question cell. |
| The model cell fails, or `status` says the address and credential differ | `<your-resource>` wasn't replaced, or doesn't match. Use the name the `credential` command printed, in both places, and run the cell again. If `status` says there's no credential, run the `credential` command first. |
| `Cannot find the external model 'casedesk_embeddings'` | The model cell hasn't run on this connection. Run the notebook from the top. In step 10, change the notebook's connection to Azure first. |
| `Msg 31622`: `An unexpected error occurred while validating that the connection to the hostname is allowed` | Some preview builds of the local container can't call out to a model. Run `npm --prefix app/ai-service run embed` instead, and skip the notebook's question cell; step 10 runs it in Azure. |
| `Msg 31742`: `Unrecoverable HTTP error 401` | The key in the credential is wrong, for example after the resource's keys were regenerated. Run the `credential` command again, with `-- <server-name>` for Azure; it replaces the key. |

### Switching AI providers later

Stop the AI service. Change the provider settings in `app/ai-service/.env`, then create every article's embedding again with the new model, following the new provider's path in [task 6.3](06-vector-search.md#task-63-generate-the-embeddings). Then run `calibrate`, which saves a new `RAG_MAX_DISTANCE`. Vectors from different models can't be compared, even when they have the same number of dimensions, and each model needs its own threshold.

## Step 7: Grounded replies

If the reply panel says to check the AI service, make sure `AI_SERVICE_URL` in the frontend's `.env.local` matches `PORT` in `app/ai-service/.env`. Check `/health` at that address and restart the frontend after changing its settings.

| Symptom | Fix |
| --- | --- |
| The AI service reports `Port 8000 is already in use` | Set `PORT` in `app/ai-service/.env` to a free port and `AI_SERVICE_URL` in `app/frontend/.env.local` to match, then restart both. |
| `No embeddings for <model>. Run "npm run embed" first.` from `calibrate` | No stored embeddings carry the label of the model in `.env`. With Azure OpenAI, check that the notebook's deployment name matches `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`. Either way, `npm --prefix app/ai-service run embed` creates matching embeddings. Then run `calibrate` again. |
| `The two groups overlap: no single threshold separates them for this model.` | Your model can't separate the test questions with one threshold. Use the models named on your AI setup page. |
| `/health` shows `stale_or_missing` above 0 | Some articles have no current embedding for this model. Run your path's embedding step in [task 6.3](06-vector-search.md#task-63-generate-the-embeddings) again; it only embeds what's missing or changed. Then restart the service. |
| Every case shows **No matching knowledge article** | `RAG_MAX_DISTANCE` is too small or still the template value. Run `calibrate`, which saves a value for your model, and restart the service. |
| Case 12 gets a cited draft instead of **No matching knowledge article** | The cutoff is too loose, so unrelated articles count as evidence and the model writes an answer from them. Small local models don't refuse on their own; the cutoff is what stops them. Run `calibrate`, restart the service, and check that the `max distance` it prints matches the saved value. |
| **Draft without citations** | The model didn't cite its sources, so the app flags the draft for review. Select **Suggest reply** again; small local models occasionally skip citations. |
| The reply panel shows `502` and `Could not reach the embedding model or the database` | Read the AI service's terminal output for the underlying error, then check the step 6 rows above. |
| **Sources only: answer model unavailable** | Retrieval works, but the chat model failed. Check `AZURE_OPENAI_CHAT_DEPLOYMENT`, or for Ollama, that `llama3.2:3b` is listed by `ollama list`. |

## Step 8: Query Store

| Symptom | Fix |
| --- | --- |
| The dashboard shows no queries | Run `05-query-store-workload.sql` on **CaseDesk**, not `master`, then refresh the dashboard. |

## Step 9: Schema change

| Symptom | Fix |
| --- | --- |
| Copilot reports `Column 'name' must be a primary key` | A foreign key in Schema Designer must reference a primary key. Ask Copilot to make `name` the primary key of `product_areas`, then publish again. |
| Publishing the foreign keys fails with `The ALTER TABLE statement conflicted with the FOREIGN KEY constraint` | `product_areas` is missing a value that a case or article uses. Run [06-product-areas.sql](../../database/06-product-areas.sql) on **CaseDesk**, then select **Apply Changes** > **Publish** again. |

## Step 10: Database in Azure

| Symptom | Fix |
| --- | --- |
| `Client with IP address ... is not allowed to access the server` | Your IP address isn't in the server firewall. Approve the firewall prompt in the wizard, or add your client IP address in the server's networking settings. |
| `Login failed for user '<token-identified principal>'` or `Cannot open database "CaseDesk"` | Your Microsoft Entra account has no user in the Azure database. See [If someone else administers the server](10-deploy-to-azure.md#if-someone-else-administers-the-server). |
| The notebook or query results match your local database, not Azure | The editor is still on **CaseDesk (local)**. Run **Change Notebook Connection** or **Change Connection (MSSQL)** from the Command Palette and choose the Azure connection. |
| `SQL71501`: `SqlExternalModel: [casedesk_embeddings] has an unresolved reference to Database Scoped Credential` | The local database still has the external model, which the wizard can't carry. Drop it as in [Task 10.1](10-deploy-to-azure.md#task-101-deploy-with-the-local-to-cloud-wizard), then run **Deploy to Azure** again. |

For errors from the `credential` command or the Azure OpenAI notebook, see the [step 6 rows](#step-6-ai-setup-and-vector-search); they apply in Azure too.

## Going further: app and API in Azure

| Symptom | Fix |
| --- | --- |
| `.env.cloud already exists` | Run the script again with `-Force` to replace the file. |
| The registration script fails with `Insufficient privileges` | Your tenant doesn't let you register apps. Ask an administrator to run `scripts/new-api-app-registration.ps1` for you, then continue with the Copilot prompt. |
| The registration script fails with `ServiceManagementReference field is required` | Your tenant requires every app registration to name the service that owns it. Get your service's ID from your tenant administrator, then run `./scripts/new-api-app-registration.ps1 -ServiceManagementReference <your-service-id>`. |
| Copilot stops before creating resources because a check failed | That's the skill's safety check working. Ask Copilot to fix what it reported, review the change, and continue. |
| Copilot can't grant `AcrPull` to the managed identity (`AuthorizationFailed` on `roleAssignments/write`) | You can't assign roles in this subscription. Ask a subscription **Owner** or **User Access Administrator** to run the `az role assignment create` command Copilot printed, or activate one of those roles through Privileged Identity Management. Then tell Copilot to continue. The registry and log workspace already exist and are billed while you wait. |
| The first revision can't pull its image | The registry permission for the managed identity is still applying. Wait a few minutes, then ask Copilot to update the container app. |
| The container app's logs show `Login failed for user '<token-identified principal>'` | The managed identity has no user in the Azure database. Ask Copilot to create it through your Azure CaseDesk connection, following the entra-id-auth skill. |
| The app shows **Cases could not be refreshed** with `401` | The token is missing or expired. Stop the frontend, run the token and address lines from [Use the hosted API from the app](going-further.md#use-the-hosted-api-from-the-app) again, and restart it. |
| The app shows **Cases could not be refreshed** with `403` | The cloud configuration doesn't grant `read` to `authenticated`. Ask Copilot to fix the permissions and redeploy. |
| The MCP server returns `403` and mentions the `Host` header | The container app's host name is missing from MCP `allowed-hosts`. Ask Copilot to add it and redeploy, following the deploy-dab-to-azure skill. |
| The `casedesk-api` MCP server returns `401` | The token expired. Copy a new one as in [Ask Copilot about your data through MCP](going-further.md#ask-copilot-about-your-data-through-mcp), then restart the server in `.vscode/mcp.json` and paste it. |
| Copilot reports `Session not found` from the MCP server | The API restarted or a new revision started. Restart the `casedesk-api` server in `.vscode/mcp.json` and paste a fresh token. |
| Copilot reports `NoEntitiesConfigured` | The request ran without your token. Restart the `casedesk-api` server and paste a fresh token; don't add `anonymous` permissions. |

---

[Overview](README.md)
