# Build CaseDesk with Azure SQL and GitHub Copilot

Take a customer-support app from hardcoded sample data to a live, AI-ready app on Azure SQL, using the MSSQL extension and GitHub Copilot in VS Code. Each step has its own page with copyable prompts and an expected result.

## 🎯 What you'll build

<!-- Screenshot to add: The finished app. Show the CaseDesk queue with case 1 open, a suggested reply with its [KB-3] citation, and the Knowledge sources list. File: ../images/00-finished-app.png -->

CaseDesk is a support console. A support engineer picks a customer case and selects **Suggest reply**. The app drafts an answer using only approved knowledge articles, with citations the engineer can check. When no article fits, it says so instead of guessing.

By the end, you will have:

- A local database whose tables Copilot designed from your app's sample data.
- A REST API over that data, generated without writing backend code.
- AI search over your own articles, running inside the same database. With Azure OpenAI, the database also creates the embeddings itself, in T-SQL.
- A schema change applied safely to tables that already hold data.
- Optionally, the same database in Azure, searched with the same notebook.

## 💡 Why Azure SQL for this app

This guide focuses on building the app. These are the benefits you'll use directly:

- **App data and AI search in one database.** Cases, accounts, and article embeddings live together. One T-SQL query can rank articles by meaning *and* join or filter on business data, with no separate vector database to keep in sync. [Step 6](06-vector-search.md) shows this.
- **The same engine on your laptop and in Azure.** The local container runs the Azure SQL Database engine, so what you build locally deploys to Azure with the same schema and data. See [steps 2](02-local-database.md) and [10](10-deploy-to-azure.md).
- **Free to start.** The local container costs nothing. In Azure, the [free offer](https://learn.microsoft.com/azure/azure-sql/database/free-offer) can pause instead of billing when its monthly allowance runs out.
- **Database tools where you already code.** The MSSQL extension designs tables, edits data, generates the API, and deploys. Copilot works against your real schema, and you approve every change.

### If you're evaluating Azure SQL

This guide doesn't cover the following, but you can expect them as an app like CaseDesk grows:

- **Grow without a rewrite.** Move from the free offer to larger tiers, up to Hyperscale for very large databases and read replicas, with the same T-SQL and app code.
- **More AI in the engine.** Vector indexes for fast approximate search over millions of embeddings, half-precision vectors that halve their storage, and chunking text directly in T-SQL.
- **History and audit built in.** Temporal tables keep every change to a row; ledger tables make records tamper-evident.
- **Reports on live data.** Columnstore indexes run analytics on the same tables the app uses, without a separate warehouse.
- **Performance that tunes itself.** Automatic tuning uses Query Store history to undo query plans that got slower.

## Choose your AI setup

You choose in [step 6](06-vector-search.md#task-61-choose-where-the-ai-runs). Azure OpenAI is the recommended path and matches the live session. Both paths use the same database and app; they differ in where the models run and in who creates the embeddings.

| | Azure OpenAI (recommended) | Ollama |
| --- | --- | --- |
| **Where the models run** | In Azure, as a managed service | Only on your machine |
| **Who creates the embeddings** | The database, with `CREATE EXTERNAL MODEL` and `AI_GENERATE_EMBEDDINGS` in a SQL notebook | The AI service, with `npm run embed`, because the database can only call a model over HTTPS |
| **Cost** | Billed per request | No usage charges; uses your own CPU or GPU, memory, and disk |
| **Reply quality** | A larger hosted model (`gpt-5.4-mini`): stronger drafts that follow the citation rules more reliably | A small local model (`llama3.2:3b`): good enough to learn the workflow, with weaker drafts and citations |
| **Speed** | Doesn't depend on your hardware | Depends on your hardware; replies are slow without a GPU |
| **You need** | An Azure subscription where you can grant yourself access to the models, as you can if you created it | Disk space and memory for the model downloads |
| **In Azure, step 10** | The same notebook runs in Azure, after one command stores the key there. A hosted app uses the same deployments and signs in with Microsoft Entra ID | Your embeddings move with the database and search the same way |
| **Setup** | [Set up Azure OpenAI](ai/azure-openai.md) | [Set up Ollama](ai/ollama.md) |

- **Choose Azure OpenAI** to match the live session, to see the database create embeddings itself, and for production-like replies.
- **Choose Ollama** to learn the workflow for free on your own machine, or if you can't assign roles in your Azure subscription.

> [!TIP]
> You can start with Ollama and [switch later](troubleshooting.md#switching-ai-providers-later): change the settings, then regenerate the embeddings and recalibrate.

## 💲 What it costs

| Part | Cost |
| --- | --- |
| Local database container, Data API builder, and the app | Free; they run on your machine |
| Ollama | No usage charges; needs disk space and memory for the local models |
| Azure OpenAI | Billed per request for embeddings and replies, separately from Azure SQL |
| Azure SQL Database, optional [step 10](10-deploy-to-azure.md) | Free offer, set to pause at its monthly limit. Step 10 explains [what happens when you outgrow it](10-deploy-to-azure.md#when-you-outgrow-the-free-offer) |
| Hosted API, optional [Going further](going-further.md) | Azure Container Apps, a container registry, and a log workspace, billed while they exist |
| GitHub Copilot | Your existing Copilot plan |

## 🗺️ Lab modules

Follow the steps in order; each one builds on the previous step.

### 🚀 Module 1: Set up and start local

| Step | Page | You will have |
| --- | --- | --- |
| 0 | [Set up](00-setup.md) | VS Code, Copilot, and the SQL agent skills ready, and the app installed |
| 1 | [Start the prototype](01-prototype.md) | CaseDesk running on hardcoded sample data |
| 2 | [Create the local database](02-local-database.md) | An Azure SQL database on your machine, created with Copilot |

### 🧱 Module 2: Design the schema and load data

| Step | Page | You will have |
| --- | --- | --- |
| 3 | [Design the schema](03-schema.md) | Tables designed with Copilot in Schema Designer, published, and visible in Object Explorer |
| 4 | [Load and edit data](04-data.md) | Realistic records and a priority update made without writing SQL |

### 🔌 Module 3: Generate a REST API

| Step | Page | You will have |
| --- | --- | --- |
| 5 | [Connect a REST API](05-data-api.md) | The app on live data through a generated API |

### 🔍 Module 4: Add vector search and grounded replies

| Step | Page | You will have |
| --- | --- | --- |
| 6 | [Add vector search](06-vector-search.md) | Your AI path set up, article embeddings, created by the database itself with Azure OpenAI, and one query that combines meaning with business data |
| 7 | [Generate grounded replies](07-grounded-replies.md) | Cited drafts and honest no-match answers |

### 🛠️ Module 5: Tune and evolve the database

| Step | Page | You will have |
| --- | --- | --- |
| 8 | [Investigate a slow request](08-query-context.md) (optional) | Copilot explaining the article search from its Query Store metrics |
| 9 | [Change the schema on live data](09-schema-change.md) | A governed product-area list, added with Copilot in Schema Designer |

### ☁️ Module 6: Deploy to Azure (optional)

| Step | Page | You will have |
| --- | --- | --- |
| 10 | [Deploy the database to Azure](10-deploy-to-azure.md) | The same database on the Azure SQL free offer, searched with the same notebook |
| 11 | [Clean up](11-cleanup.md) | Only the lab's services and resources removed |

To connect the app to the Azure database, or to host the API with an MCP endpoint that Copilot queries, see [Going further](going-further.md).

## 📋 How to use these pages

- The live session covers these steps in 45 minutes with every download done in advance. On your own, expect a few large downloads: the database container image in step 2 and, for Ollama, the local models in step 6.
- Run commands from the **repository root** in **PowerShell**. You'll use up to three VS Code terminals, each opened with **Terminal > New Terminal**: the **frontend terminal** from step 1, the **command terminal** for commands that run and finish from step 6, and the **AI service terminal** from step 7.
- Step 0 creates two git-ignored settings files: `app/frontend/.env.local` for the frontend's mode and addresses, and `app/ai-service/.env` for the AI service's database and model settings. Change ports and modes there, not in source code, then restart the app whose settings you changed.
- Each **Copilot prompt** is a `text` block with a Copy button. For database prompts, right-click **CaseDesk** in **Connections** and select **Open in GitHub Copilot Agent**; for code changes, use **Copilot Chat** in **Agent** mode.
- Copilot proposes; you approve. Read each script before you allow it to change the database. If Copilot's database change doesn't work out, steps 3, 6, and 9 point to a reference script in [database/](../../database/).
- Each page ends with an **Expected result**. If yours differs, check [Troubleshooting](troubleshooting.md).
- Taking a break? See [Coming back after a break](troubleshooting.md#coming-back-after-a-break).
- Some MSSQL extension features in this guide are in preview; the repository's [What you will learn](../../README.md#what-you-will-learn) section marks them.
