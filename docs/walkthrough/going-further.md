# Going further: Connect and host the app in Azure

[Previous: Deploy the database to Azure](10-deploy-to-azure.md) | [Overview](README.md) | [Clean up](11-cleanup.md)

Step 10 moved the database to Azure and checked it there. This page connects the rest of CaseDesk to it. It's optional and goes beyond the lab: hosting, sign-in, and costs for the app tier are decisions for the team that runs the app.

| Section | Cost | You need |
| --- | --- | --- |
| [Point the AI service at Azure](#point-the-ai-service-at-azure) | Free | Step 10 |
| [Host the API on Azure Container Apps](#host-the-api-on-azure-container-apps) | Billed while the resources exist | **Owner** or **User Access Administrator**, and permission to register apps |
| [Host the AI service and frontend](#host-the-ai-service-and-frontend) | Billed while the resources exist | Your own hosting design |

## Point the AI service at Azure

Use this as a check before you host anything: the app's own queries run against the deployed database, signing in with Microsoft Entra ID instead of a password. The AI service keeps running on your machine.

1. Stop the AI service in the AI service terminal with **Ctrl+C**. Leave the frontend running.
2. In the command terminal, sign in to Azure CLI with the same account you used in the wizard. Install [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) first if you don't have it, then restart VS Code so its terminals can find `az`, and start the frontend again in the frontend terminal.

```powershell
az login
```

3. Create the cloud settings file. Replace `<server-name>` with your logical server's name, as in [task 10.2](10-deploy-to-azure.md#azure-openai-path); `.database.windows.net` is optional:

```powershell
./scripts/new-cloud-env.ps1 -Server <server-name>
```

The [script](../../scripts/new-cloud-env.ps1) copies your AI provider, models, and calibrated threshold from `.env` into `.env.cloud`, and switches the database settings to Azure with Microsoft Entra ID. It leaves the local password behind.

4. Start the service against Azure in the AI service terminal:

```powershell
npm --prefix app/ai-service run dev:cloud
```

5. Check that the AI service's startup line names your Azure server with `entra auth`. Open `/health` at your AI-service address, for example http://127.0.0.1:8000/health with the default port, and check that `ai.provider` is unchanged and `stale_or_missing` is **0**. The cloud settings keep your `PORT`, so the frontend needs no change. Refresh the app, open case 1, and select **Suggest reply**.

> [!NOTE]
> **Expected result:** suggested replies read from Azure SQL Database, with the same articles as before, though the wording can vary. The case queue still comes from your local API and database until you host the API; right after deployment, both databases hold the same data.

To go back to the local database, stop the service and run `npm --prefix app/ai-service run dev`.

## Host the API on Azure Container Apps

> [!CAUTION]
> **This costs money.** Unlike the free Azure SQL database from step 10, the API's container app, container registry, and log workspace are billed for as long as they exist, even when nobody calls the API. Delete them as described in [clean up](11-cleanup.md) as soon as you're done.

Until now, the API has run on your machine without sign-in. Here Copilot hosts it on Azure Container Apps with Microsoft Entra ID sign-in, so other apps and AI agents can use it, and then you ask Copilot about your data through the API's MCP endpoint. Copilot follows the **deploy-dab-to-azure** and **dab-mcp-endpoint** skills you added in step 0.

> [!IMPORTANT]
> Copilot creates the resource group `rg-casedesk-api` with a container app, container registry, managed identity, and log workspace, and asks you to confirm the costs before it creates anything. You need:
>
> - **Owner** or **User Access Administrator** on the subscription. **Contributor** isn't enough: Copilot must let the API's managed identity pull its image from the registry, which is a role assignment. If you don't have one of those roles, skip this section, or ask an administrator before you start.
> - Permission to register apps in your Microsoft Entra tenant.
> - To be the database server's Microsoft Entra admin, which you are if you created it in step 10.

### Register the API in Microsoft Entra ID

In the command terminal, run:

```powershell
./scripts/new-api-app-registration.ps1
```

The [script](../../scripts/new-api-app-registration.ps1) creates the `casedesk-api` app registration, which issues the tokens the API accepts. It creates no secret. If it fails with `ServiceManagementReference field is required`, see [troubleshooting](troubleshooting.md#going-further-app-and-api-in-azure).

### Deploy the API with Copilot

1. Open **Copilot Chat** (**Ctrl+Alt+I**), select **Agent** mode, and paste:

**Copilot prompt 8: Deploy the API to Azure**

```text
Implement "Hosted API" from docs/PRD.md, following the deploy-dab-to-azure
and dab-mcp-endpoint skills. Confirm costs and settings with me before
creating anything.
```

2. Answer Copilot's questions about the subscription, region, and costs, and read each command before you approve it.
3. Before Copilot builds the image, open the cloud configuration it wrote in `dab/azure/` and check three things:
   - `accounts` and `support_cases` grant `read` to `authenticated`, and nothing to `anonymous`.
   - The connection string uses a managed identity and contains no password.
   - MCP's write tools are turned off.
4. Let Copilot finish. It confirms that a request without a token is refused, a request with a token returns data, and the MCP endpoint answers, then adds the endpoint to `.vscode/mcp.json` as `casedesk-api`.

<!-- Screenshot to add: Hosted API verification. Show Copilot's verification results: a request without a token refused with 403, one row returned with a token, and the MCP endpoint's initialize response. File: ../images/11-api-verification.png -->

### Ask Copilot about your data through MCP

1. In the command terminal, copy a token for the API to the clipboard:

```powershell
$apiId = az ad app list --display-name casedesk-api --query "[0].appId" -o tsv
az account get-access-token --scope "api://$apiId/.default" --query accessToken -o tsv | Set-Clipboard
```

2. Open `.vscode/mcp.json`, select **Start** above the `casedesk-api` server, and paste the token when VS Code asks for it.
3. In **Agent** mode, paste the prompt below, then approve the MCP tool calls after reading them.

**Copilot prompt 9: Ask about your data**

```text
Using the casedesk-api MCP server, which account has the most open
support cases, and how many does it have? Open means any status except
Resolved.
```

<!-- Screenshot to add: Copilot answering through MCP. Show Copilot calling the casedesk-api tools and answering with the account and its open-case count. File: ../images/11-mcp-copilot-answer.png -->

> [!NOTE]
> **Expected result:** the hosted API refuses requests without a token, and Copilot answers through its MCP endpoint: **Litware Health**, with **3** open cases. Copilot can only read, because the API grants read access only and its write tools are turned off. Wording and detail vary by model.

### Use the hosted API from the app

To load the app's case queue through the hosted API, stop the frontend with **Ctrl+C**, then run this in the frontend terminal:

```powershell
$apiId = az ad app list --display-name casedesk-api --query "[0].appId" -o tsv
$env:DAB_TOKEN = az account get-access-token --scope "api://$apiId/.default" --query accessToken -o tsv
$env:DAB_URL = "https://" + (az containerapp show -g rg-casedesk-api -n casedesk-api --query properties.configuration.ingress.fqdn -o tsv)
npm --prefix app/frontend run dev
```

The queue shows the same **17 of 24** open cases. The development server adds the token to each request, so the browser never sees it. Tokens expire; when the app reports `401`, run these lines again. To return to the local API, stop the frontend, run `Remove-Item Env:DAB_URL, Env:DAB_TOKEN`, and start it again.

Before other teams use the API, give each calling app its own identity and role, and review the skill's guidance on scaling and rollback.

## Host the AI service and frontend

This repository doesn't include hosting for them. You can host both with the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/), the same way. Plan for these changes:

- **Network:** the AI service listens on `127.0.0.1` only. In a container, it must listen on all interfaces.
- **Identity:** give the hosted service a managed identity with read access to the database and **Cognitive Services OpenAI User** on Azure OpenAI. Granting that role needs an **Owner** or **User Access Administrator**.
- **Models:** use Azure OpenAI. Ollama on your laptop isn't reachable from Azure, and hosting it yourself means running and paying for GPU servers.
- **Sign-in:** require it in front of `/assist`, because every call spends model tokens.

---

[Previous: Deploy the database to Azure](10-deploy-to-azure.md) | [Overview](README.md) | [Clean up](11-cleanup.md) | [Troubleshooting](troubleshooting.md)
