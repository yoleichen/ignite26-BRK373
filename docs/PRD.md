# CaseDesk: Product Requirements Document

## Overview

CaseDesk is the support console for **Relecloud Connect**, a fictional B2B field-operations platform. Support engineers work a queue of customer cases and, for each case, get a **suggested reply drafted from the approved knowledge base**, with citations they can check before sending.

It is a deliberately small, realistic line-of-business app: relational data, a REST API, and retrieval-augmented generation (RAG) over data that already lives in **Azure SQL Database**. It runs locally on the Azure SQL Database container and moves unchanged to Azure SQL Database in Azure.

## Goals

1. Show a support engineer an ordered queue of open cases with their customer account.
2. Show case details and let the engineer filter the queue by status.
3. For any case, retrieve the most relevant knowledge articles with native vector search in Azure SQL Database.
4. Draft a reply grounded only in those articles, with every statement cited as `[KB-<id>]`.
5. Say clearly when no article is relevant, instead of guessing.
6. Run the same code against the local container and against Azure SQL Database in Azure; only configuration changes.

## User stories

### Case queue
- As a support engineer, I see open cases ordered by priority (Critical first), then newest first.
- As a support engineer, I can filter the queue by status: Open, All, New, In Progress, Waiting on Customer, Resolved.
- As a support engineer, I see each case's account, product area, status, and when it was opened.

### Suggested replies
- As a support engineer, I can ask for a suggested reply for the selected case, and edit the question before sending it.
- As a support engineer, I see which knowledge articles were retrieved, their cosine distance, and which ones the draft cites.
- As a support engineer, I am told when no approved article answers the case, so I escalate it.
- As a support engineer, I am warned when a draft has no valid citations or when the answer model is unavailable.
- As a team lead, I know drafts are never sent automatically; a person reviews every reply.

### Data maintenance
- As a support lead, I correct case data (for example, priority) directly in the database with the MSSQL extension's **Edit Table Data**, and the queue reflects it on refresh.
- As a support lead, product areas come from one governed list, so a typo cannot hide a case from reports *(added in walkthrough step 9)*.

## Technical requirements

### Database
- **Azure SQL Database** only (`SERVERPROPERTY('EngineEdition') = 5`): the local Azure SQL Database container for development, Azure SQL Database (free offer) in Azure.
- Database name `CaseDesk`, selected in the connection (no `USE`).
- Lowercase snake_case table and column names in `dbo`; `INT IDENTITY` primary keys named `id`; `NVARCHAR` text.
- Embeddings are stored in a separate table so the business tables never change when the embedding model changes.

### Data API
- **Data API builder** generated from the MSSQL extension, REST only.
- Read-only access to `accounts` and `support_cases`. Knowledge articles and embeddings are not exposed.
- Optionally hosted on Azure Container Apps *(walkthrough, Going further)*: Microsoft Entra ID sign-in with read access for authenticated callers only, a managed identity to the database, and REST plus a read-only MCP endpoint.

### AI service
- **Node.js + TypeScript + Express**, `mssql` driver, one module-level connection pool, parameterized SQL only.
- Embedding providers: **Azure OpenAI** (`text-embedding-3-small` asked for 768 dimensions) by default; **Ollama** (`nomic-embed-text`) as a local option.
- Retrieval with `VECTOR_DISTANCE('cosine', ...)`, filtered to the active embedding model, top 3, with a calibrated distance threshold.
- Microsoft Entra ID for Azure resources; no keys or passwords in source.

### Frontend
- **React + Vite + TypeScript**. Starts on hardcoded sample data in `src/data/sampleData.ts`; one setting switches it to the live Data API builder endpoint.
- Development server proxies `/api` to Data API builder and `/ai` to the AI service.
- Per-developer settings live in git-ignored `app/frontend/.env.local`, copied from `.env.example`: `VITE_DATA_SOURCE` selects `sample` or `dab`, `DEV_SERVER_PORT` sets the frontend port, and `DAB_URL` and `AI_SERVICE_URL` select the service addresses. No source edits are required for local ports. Only non-sensitive settings may use the browser-visible `VITE_` prefix.

## Data model

```
accounts
  id            INT IDENTITY (PK)
  name          NVARCHAR(100), unique
  industry      NVARCHAR(50)
  tier          NVARCHAR(20)   Standard | Premium | Enterprise
  region        NVARCHAR(50)

support_cases
  id            INT IDENTITY (PK)
  account_id    INT (FK -> accounts.id)
  title         NVARCHAR(200)
  description   NVARCHAR(2000)
  product_area  NVARCHAR(50)
  priority      NVARCHAR(20)   Low | Medium | High | Critical
  status        NVARCHAR(30)   New | In Progress | Waiting on Customer | Resolved
  opened_at     DATETIME2(0)
  resolved_at   DATETIME2(0), nullable

kb_articles
  id            INT IDENTITY (PK)
  title         NVARCHAR(200), unique
  product_area  NVARCHAR(50)
  content       NVARCHAR(4000)
  updated_at    DATETIME2(0)

kb_article_embeddings            (added in the AI step)
  article_id      INT (PK, FK -> kb_articles.id, cascade delete)
  embedding_model NVARCHAR(100)  provider:model:dimensions
  content_hash    BINARY(32)     SHA-256 of title + content when embedded
  embedding       VECTOR(768)
  embedded_at     DATETIME2(0)   defaults to the current UTC time

product_areas                    (added in walkthrough step 9)
  name          NVARCHAR(50) (PK); referenced by support_cases.product_area
                and kb_articles.product_area
```

## API

| Service | Method | Path | Description |
|---|---|---|---|
| Data API builder | GET | `/api/accounts` | List accounts |
| Data API builder | GET | `/api/support_cases` | List cases (supports `$filter`, `$orderby`, `$first`) |
| AI service | GET | `/health` | Database reachability, engine edition, embedding coverage |
| AI service | POST | `/assist` | `{ "question": "..." }` → suggested reply, citations, retrieved sources |

## Seed data

Synthetic and deterministic ([database/02-seed.sql](../database/02-seed.sql)): 8 accounts using Microsoft's fictional company names, 24 support cases across 9 product areas, and 12 knowledge articles. One open case (on-premises hosting) intentionally has no matching article, to demonstrate the "no match" path.

## Changes built during the walkthrough

The walkthrough builds these changes with GitHub Copilot. Prompts point here, so the requirements live in the spec rather than in the prompt.

### Governed product areas (walkthrough step 9)

Step 9 makes the schema changes in Schema Designer and fills the list with a SQL script.

- Create `dbo.product_areas` as defined in the data model. `name` is the primary key, so the existing `product_area` columns can reference it directly.
- Fill it from the distinct `product_area` values already in `support_cases` and `kb_articles`.
- Add foreign keys from `support_cases.product_area` and `kb_articles.product_area` to `product_areas.name`, validated against existing rows.
- Expand only: no existing column, value, or Data API builder path changes, so the running app keeps working.

### In-database embeddings (walkthrough step 6, Azure OpenAI path)

- With Azure OpenAI, the database creates the article embeddings itself. The database can only reach a model over HTTPS, so the Ollama path uses the AI service instead.
- External model `casedesk_embeddings` for the AI service's embedding deployment, with `MODEL` set to the deployment name and 768 dimensions requested, so its vectors match the AI service's.
- The Azure OpenAI key lives only in a database scoped credential named after the endpoint, created by `npm run credential` so the key never appears in a prompt, file, or terminal output. In Azure (step 10), the same command stores it again, because secrets don't move with the data.
- Article embeddings follow the AI service's conventions, so the app treats them as current: `embedding_model` is `azure-openai:<deployment>:768`, and `content_hash` is `HASHBYTES('SHA2_256', CONCAT(title, NCHAR(10), content))`.
- The app's own retrieval doesn't change: it embeds each question with the same deployment.

### Hosted API (walkthrough, Going further)

- Host `dab/dab-config.json` on Azure Container Apps as `casedesk-api`, in a new resource group `rg-casedesk-api` in the same region as the Azure `CaseDesk` database. Keep `dab/dab-config.json` unchanged for local use; put the cloud configuration and Dockerfile in `dab/azure/`.
- Reach the database with a user-assigned managed identity. Create its read-only database user through the Azure `CaseDesk` connection that the deployment wizard saved.
- Require Microsoft Entra ID sign-in with the `casedesk-api` app registration. Authenticated callers can read `accounts` and `support_cases`; anonymous callers get nothing.
- Enable REST and MCP, with the MCP write tools turned off.
- Verify the deployment: a request without a token is refused, a request with a token returns data, and the MCP endpoint answers.
- Add the MCP endpoint to `.vscode/mcp.json` as a server named `casedesk-api` that prompts for the access token when it starts. Never write a token to a file.

## Non-goals

- User sign-in or role-based access (the demo runs on localhost; see the hosting note in the README before exposing anything).
- Sending replies to customers, or any automatic action on a case.
- Writes through the public API.
- Uploading documents or ingesting arbitrary files.
- Multi-tenant isolation.
- Production hosting of the web app and AI service. The hosted API in Going further is a sign-in-protected pilot, not a production deployment.
