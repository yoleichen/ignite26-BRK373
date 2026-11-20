# Data API builder reference configuration

[dab-config.json](dab-config.json) is the configuration the demo builds with **Build Data API...** in the MSSQL extension. It was generated with the Data API builder 2.1.5 CLI, the version the extension uses.

It exposes a read-only REST API on `/api` for exactly two tables:

| Entity | Source | Anonymous permissions |
|---|---|---|
| `accounts` | `dbo.accounts` | read |
| `support_cases` | `dbo.support_cases` | read |

GraphQL and MCP are disabled. `kb_articles` and `kb_article_embeddings` are not exposed. Data changes in the demo happen through **Edit Table Data...** in the MSSQL extension.

> [!NOTE]
> In Data API builder 2.1.5, a REST `PATCH` also requires the `create` permission because it can upsert. This lab keeps the API read-only rather than grant anonymous create.

## Use the extension

Follow [step 5 of the walkthrough](../docs/walkthrough/05-data-api.md): **CaseDesk > Build Data API...**, configure the two read-only entities with Copilot, review permissions, and deploy locally. Port **5000** is the default, not a requirement. Set the actual API address as `DAB_URL` in `app/frontend/.env.local`, set `VITE_DATA_SOURCE=dab`, and restart the frontend. The browser continues to use the frontend's printed **Local** URL.

This JSON file documents the expected API surface. Its connection string is an environment-variable reference, not a credential embedded in source.

To host this API in Azure, follow [Going further](../docs/walkthrough/going-further.md#host-the-api-on-azure-container-apps). Copilot, guided by the deploy-dab-to-azure skill, creates a separate cloud configuration in `dab/azure/` with Microsoft Entra ID sign-in, read access for `authenticated` only, a managed identity to the database, and REST plus a read-only MCP endpoint, then deploys it to Azure Container Apps. This file stays unchanged for local use. The configuration is identical for Azure OpenAI and Ollama, and step 9's governed product areas don't change it.

> [!IMPORTANT]
> `development` mode with anonymous access is for localhost only. Before hosting this API anywhere, configure an authentication provider and roles. See [Data API builder security](https://learn.microsoft.com/azure/data-api-builder/concept/security/).
