import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The browser calls same-origin paths; Vite forwards them. No CORS changes are needed in
// Data API builder or the AI service.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), ["VITE_DATA_SOURCE", "DAB_", "AI_SERVICE_URL", "DEV_SERVER_PORT"]);
  if (env.VITE_DATA_SOURCE !== undefined && !["sample", "dab"].includes(env.VITE_DATA_SOURCE)) {
    throw new Error("VITE_DATA_SOURCE must be sample or dab.");
  }
  const port = Number(env.DEV_SERVER_PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DEV_SERVER_PORT must be a whole number between 1 and 65535.");
  }
  const targets = {
    DAB_URL: env.DAB_URL ?? "http://127.0.0.1:5000",
    AI_SERVICE_URL: env.AI_SERVICE_URL ?? "http://127.0.0.1:8000",
  };
  for (const [name, value] of Object.entries(targets)) {
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error();
    } catch {
      throw new Error(`${name} must be an absolute http:// or https:// URL.`);
    }
  }
  const dabToken = env.DAB_TOKEN;

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: targets.DAB_URL,
          changeOrigin: true,
          ...(dabToken ? { headers: { Authorization: `Bearer ${dabToken}` } } : {}),
        },
        "/ai": {
          target: targets.AI_SERVICE_URL,
          rewrite: (path) => path.replace(/^\/ai/, ""),
        },
      },
    },
  };
});
