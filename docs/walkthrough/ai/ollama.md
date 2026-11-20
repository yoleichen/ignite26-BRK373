# AI setup: Ollama

[Back to step 6](../06-vector-search.md#task-61-choose-where-the-ai-runs) | [Overview](../README.md)

Ollama runs two AI models on your machine: one turns text into embeddings, lists of numbers that capture meaning, and one writes the reply drafts. You don't need an Azure account, and there are no AI usage charges. GitHub Copilot is still needed for the Copilot steps.

> [!IMPORTANT]
> **Ollama is local only.** CaseDesk can use it while the AI service runs on this machine. A hosted version of the app can't reach your laptop: you would switch to a hosted provider such as Azure OpenAI, or run Ollama on cloud servers that you set up, secure, and pay for yourself. The reply model is also small, so expect weaker drafts than a hosted model. Both are fine for learning the workflow.

## Install Ollama and download the models

1. Install [Ollama](https://ollama.com/download) and start it. Keep it running while you work through the AI steps.
2. Open **PowerShell** from the Windows Start menu (on macOS, the Terminal app). Use this separate window, not a VS Code terminal: VS Code's terminals can't find the new `ollama` command until you restart VS Code. Download both models there. They're large; let them finish while you continue with step 6:

```powershell
ollama pull nomic-embed-text
ollama pull llama3.2:3b
```

`nomic-embed-text` creates the embeddings. `llama3.2:3b` writes the replies. Reply speed depends on your hardware; a GPU helps.

3. When the downloads finish, confirm in the same window that both models are listed:

```powershell
ollama list
```

## Select Ollama for the AI service

Open `app/ai-service/.env`, which you created in [step 0](../00-setup.md#task-02-get-the-code). Change `AI_PROVIDER=azure` to `AI_PROVIDER=ollama`, and save the file. The Ollama address and model names already in that file match the models you're downloading.

> [!NOTE]
> **Expected result:** `app/ai-service/.env` contains `AI_PROVIDER=ollama`, and once the downloads finish, `ollama list` shows both `nomic-embed-text` and `llama3.2:3b`.

## Continue

Return to [Task 6.2](../06-vector-search.md#task-62-add-the-embeddings-table-with-copilot); you don't need to wait for the downloads. Task 6.3 is the first task that uses the models. If you later deploy the database to Azure, Ollama can keep running on your machine.

---

[Back to step 6](../06-vector-search.md#task-61-choose-where-the-ai-runs) | [Overview](../README.md) | [Troubleshooting](../troubleshooting.md)