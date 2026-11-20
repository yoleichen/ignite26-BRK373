# Agent instructions

These rules apply to any AI coding agent working in this repository. GitHub Copilot reads the same rules from [.github/copilot-instructions.md](.github/copilot-instructions.md); keep both files in sync.

- **Product scope:** [docs/PRD.md](docs/PRD.md).
- **Database:** Azure SQL Database T-SQL only, database `CaseDesk`, lowercase snake_case names, no `USE` statements. Checkpoint scripts live in [database/](database/) and run in numeric order.
- **Vectors:** `dbo.kb_article_embeddings.embedding` is `VECTOR(768)`. Always filter by `embedding_model` and rank with `VECTOR_DISTANCE('cosine', ...)` ascending. For approximate search, use a vector index with `VECTOR_SEARCH` and `SELECT TOP (N) WITH APPROXIMATE`, never the deprecated `TOP_N` parameter.
- **Frontend:** [app/frontend](app/frontend), React + Vite + TypeScript, snake_case data objects.
- **AI service:** [app/ai-service](app/ai-service), Express + `mssql`, parameterized queries, one connection pool.
- **Secrets:** never in source. Local settings go in git-ignored `.env` files; Azure uses Microsoft Entra ID.
- **Verify:** after changing files in an app folder, run `npm test` and `npm run build` in that folder before declaring the change complete. Database-only changes don't need these app checks.
