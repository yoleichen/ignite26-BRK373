# 11. Clean up

[Previous: Deploy the database to Azure](10-deploy-to-azure.md) | [Overview](README.md)

## 🎉 Congratulations

You built CaseDesk end to end on Azure SQL with the MSSQL extension and GitHub Copilot:

- ✅ Module 1: Set up and start local
- ✅ Module 2: Design the schema and load data
- ✅ Module 3: Generate a REST API
- ✅ Module 4: Add vector search and grounded replies
- ✅ Module 5: Tune and evolve the database
- ✅ Module 6: Deploy to Azure (optional)

For documentation and next steps, see [Resources and Next Steps](../../README.md#-resources-and-next-steps).

Remove only what you created for this lab.

## Task 11.1: Clean up local resources

1. Stop the frontend and AI service with **Ctrl+C** in their terminals.
2. Stop Data API builder: in **Connections**, right-click **CaseDesk** and select **Build Data API...**. Open the deployment's **Deployment actions** menu, select **Delete**, and confirm. This stops the API and removes its generated configuration.
3. In **Connections**, right-click **CaseDesk (local)** and select **Delete SQL Container**. This deletes the container and its data.
4. If you used Ollama, quit it when you no longer need it. To reclaim disk space, remove only this lab's models in a PowerShell window from the Start menu:

```powershell
ollama rm nomic-embed-text
ollama rm llama3.2:3b
```

Keep models that other projects use.

## Task 11.2: Remove Azure resources you created

- **Hosted API ([Going further](going-further.md#host-the-api-on-azure-container-apps)):** delete the resource group that holds the container app, registry, managed identity, and log workspace, then the app registration. If you added the `casedesk-api` server to `.vscode/mcp.json`, remove it too.

```powershell
az group delete --name rg-casedesk-api
az ad app delete --id (az ad app list --display-name casedesk-api --query "[0].appId" -o tsv)
```

- **Azure SQL database (step 10):** delete the CaseDesk database, and the logical server if you created it only for this lab. If you keep the database and chose Azure OpenAI, remove the key that step 10 stored in it. On the Azure **CaseDesk** database, replacing `<resource>` with your Azure OpenAI resource name, run:

```sql
DROP EXTERNAL MODEL casedesk_embeddings;
DROP DATABASE SCOPED CREDENTIAL [https://<resource>.openai.azure.com/];
```

- **Azure OpenAI:** if the setup script created `rg-casedesk-ai` and nothing else uses it, delete the whole resource group:

```powershell
az group delete --name rg-casedesk-ai
```

Don't delete resource groups or resources that other work shares.

> [!NOTE]
> **Expected result:** the lab's services are stopped and no unwanted lab resources remain. The SQL free offer doesn't cover Azure OpenAI or the hosted API, so delete those resources when you're done with them.

---

[Previous: Deploy the database to Azure](10-deploy-to-azure.md) | [Overview](README.md) | [Troubleshooting](troubleshooting.md)
