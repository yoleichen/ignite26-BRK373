# AI setup: Azure OpenAI

[Back to step 6](../06-vector-search.md#task-61-choose-where-the-ai-runs) | [Overview](../README.md)

Azure OpenAI runs two models for CaseDesk: one turns text into embeddings, lists of numbers that capture meaning, and one writes the reply drafts. The AI service signs in with Microsoft Entra ID, so the app stores no API key. In step 6, the database gets the key, encrypted in a database credential, so it can call the embedding model itself. You never copy or paste the key: a command reads it with your Azure sign-in and stores it without printing it. Requests are billed to your Azure subscription, separately from Azure SQL.

Compared with Ollama, the database creates the embeddings itself in T-SQL, a larger model writes stronger drafts, replies don't depend on your hardware, and a deployed version of the app can use the models as is.

## What you need

> [!IMPORTANT]
> **You must be able to assign roles**: **Owner** or **User Access Administrator** on the subscription or resource group. If you created your Azure subscription yourself, for example a free or pay-as-you-go account, you're its Owner, so you're set. In a company subscription you might only be a **Contributor**, which isn't enough: the AI service signs in to the models with Microsoft Entra ID instead of a key, which needs a role on the resource that only those roles can grant, whether you use the script or the portal. In that case, [use Ollama](ollama.md), or ask an administrator to grant you **Cognitive Services OpenAI User**.

- An Azure subscription where you have one of those roles.
- Permission to read the resource's keys, with key access turned on, which is the default. If you create the resource, you have it. The database calls the embedding model with that key.
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli). If you install it now, close all VS Code windows and reopen VS Code afterward, so its terminals can find `az`.

## Create the resource and models

In the **command terminal**, the second VS Code terminal from [Task 6.1](../06-vector-search.md#task-61-choose-where-the-ai-runs), run these two commands from the repository root, one at a time.

1. Sign in to Azure. If you have more than one subscription, choose the one to use when prompted.

```powershell
az login
```

2. Create the resource and models. Pick a region that offers both models; the example uses `eastus2`.

```powershell
./scripts/new-azure-openai.ps1 -Location eastus2
```

The [script](../../../scripts/new-azure-openai.ps1) does four things:

1. Creates the resource group `rg-casedesk-ai`.
2. Creates an Azure OpenAI resource with a custom subdomain, which Microsoft Entra ID sign-in requires.
3. Deploys `text-embedding-3-small` for embeddings and `gpt-5.4-mini` for replies.
4. Gives your account the **Cognitive Services OpenAI User** role on that resource.

> [!TIP]
> Role assignments can take a few minutes to apply. Continue with step 6 while they do.
>
> If the script warns that you can't assign roles, everything else is set up. Ask a subscription **Owner** or **User Access Administrator** to run the `az role assignment create` command it printed. Until they do, the AI service can't call the models.

## Select Azure OpenAI for the AI service

Azure OpenAI is the default in the AI service's settings, and the script fills in its values, so you usually don't need to change anything. Open [app/ai-service/.env](../../../app/ai-service/.env) and check these lines:

| Setting | Should be |
| --- | --- |
| `AI_PROVIDER` | `azure`. Change it back if you set it to `ollama` earlier. |
| `AZURE_OPENAI_ENDPOINT` | The `https://<name>.openai.azure.com` address the script printed |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | `text-embedding-3-small` |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | `gpt-5.4-mini` |

If you changed anything, save the file.

> [!NOTE]
> **Expected result:** the script ends with `Ready: https://<name>.openai.azure.com`, and `app/ai-service/.env` contains `AI_PROVIDER=azure` and that endpoint.

## Prefer the portal, or already have deployments?

You can skip the script and use an Azure OpenAI resource you create in the portal or already have:

1. If you don't have one, [create an Azure OpenAI resource](https://learn.microsoft.com/azure/foundry-classic/openai/how-to/create-resource) in the Azure portal, then [deploy](https://learn.microsoft.com/azure/foundry-classic/openai/how-to/create-resource#deploy-a-model) `text-embedding-3-small` and `gpt-5.4-mini`.
2. On the resource, select **Access control (IAM)** > **Add role assignment**, and give yourself **Cognitive Services OpenAI User**.
3. In `app/ai-service/.env`, set the four settings in the table above. Use the resource's endpoint and your deployment names, which can differ from the model names.
4. In the command terminal, run `az login`. The AI service uses that sign-in to call the models.

## Continue

Return to [Task 6.2](../06-vector-search.md#task-62-add-the-embeddings-table-with-copilot).

---

[Back to step 6](../06-vector-search.md#task-61-choose-where-the-ai-runs) | [Overview](../README.md) | [Troubleshooting](../troubleshooting.md)