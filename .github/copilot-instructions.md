# CaseDesk: GitHub Copilot instructions

CaseDesk is a customer-support case app. Read [docs/PRD.md](../docs/PRD.md) for scope.

## Database: Azure SQL Database only

- Generate T-SQL for **Azure SQL Database** (`SERVERPROPERTY('EngineEdition') = 5`). Never generate PostgreSQL, MySQL, or SQLite syntax: no `LIMIT`, `SERIAL`, `RETURNING`, `ILIKE`, `NOW()`, or `TEXT` columns.
- The database is `CaseDesk`. Select it in the connection, never with `USE`.
- Table and column names are **lowercase snake_case** in the `dbo` schema.
- Core tables: `accounts`, `support_cases`, `kb_articles`. Use `INT IDENTITY(1,1)` primary keys named `id` and `NVARCHAR` for text.
- `support_cases.account_id` references `accounts.id`.
- Embeddings live only in `kb_article_embeddings`, using `VECTOR(768)` and the `embedding_model` column. Never add vector columns to the business tables.
- Use `VECTOR_DISTANCE('cosine', ...)`: a smaller distance is closer. Always filter by `embedding_model` so vectors from different models are never compared.
- At this data size, rank with exact `VECTOR_DISTANCE`. For approximate search, use a vector index with `VECTOR_SEARCH` and `SELECT TOP (N) WITH APPROXIMATE`, never the deprecated `TOP_N` parameter.
- Show T-SQL for review before running anything that changes schema or data.

## Application code

- `app/frontend`: React + Vite + TypeScript. Data objects use the database column names (snake_case) because Data API builder returns them unchanged.
- `app/ai-service`: Node.js + TypeScript + Express. Use the `mssql` package with one module-level pool and parameterized queries only.
- Never put secrets in source, prompts, or the browser bundle. Use `.env` files (git-ignored), Microsoft Entra ID for Azure, and `.env.example` for documentation.
- Suggested replies are drafts for a human. Cite knowledge articles as `[KB-<id>]` and never invent sources.
