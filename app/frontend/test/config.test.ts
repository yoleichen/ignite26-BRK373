// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "vite";
import viteConfig from "../vite.config";

vi.mock("vite", async (importOriginal) => {
  const original = await importOriginal<typeof import("vite")>();
  return { ...original, loadEnv: vi.fn() };
});

beforeEach(() => {
  vi.resetModules();
  vi.mocked(loadEnv).mockReturnValue({});
});

afterEach(() => vi.unstubAllEnvs());

describe("frontend settings", () => {
  it("defaults to sample mode without a local setting", async () => {
    vi.stubEnv("VITE_DATA_SOURCE", undefined);
    expect((await import("../src/config")).DATA_SOURCE).toBe("sample");
  });

  it.each(["sample", "dab"])("accepts %s mode", async (mode) => {
    vi.stubEnv("VITE_DATA_SOURCE", mode);
    expect((await import("../src/config")).DATA_SOURCE).toBe(mode);
  });

  it.each(["live", ""])("rejects data source %j", async (mode) => {
    vi.stubEnv("VITE_DATA_SOURCE", mode);
    await expect(import("../src/config")).rejects.toThrow("VITE_DATA_SOURCE must be sample or dab");
  });
});

describe("development server settings", () => {
  it("preserves the default ports and same-origin proxies", () => {
    expect(viteConfig({ command: "serve", mode: "test" })).toMatchObject({
      server: {
        host: "127.0.0.1",
        port: 3000,
        strictPort: true,
        proxy: {
          "/api": { target: "http://127.0.0.1:5000" },
          "/ai": { target: "http://127.0.0.1:8000" },
        },
      },
    });
  });

  it("uses local settings for all three ports and keeps tokens on the proxy", () => {
    vi.mocked(loadEnv).mockReturnValue({
      VITE_DATA_SOURCE: "dab",
      DEV_SERVER_PORT: "3100",
      DAB_URL: "http://127.0.0.1:5100",
      AI_SERVICE_URL: "http://127.0.0.1:8100",
      DAB_TOKEN: "test-proxy-token",
    });
    expect(viteConfig({ command: "serve", mode: "test" })).toMatchObject({
      server: {
        port: 3100,
        proxy: {
          "/api": {
            target: "http://127.0.0.1:5100",
            headers: { Authorization: "Bearer test-proxy-token" },
          },
          "/ai": { target: "http://127.0.0.1:8100" },
        },
      },
    });
  });

  it.each(["0", "65536", "3000.5", "not-a-port", ""])("rejects port %j", (port) => {
    vi.mocked(loadEnv).mockReturnValue({ DEV_SERVER_PORT: port });
    expect(() => viteConfig({ command: "serve", mode: "test" })).toThrow("DEV_SERVER_PORT");
  });

  it.each(["DAB_URL", "AI_SERVICE_URL"])("rejects an invalid %s", (name) => {
    vi.mocked(loadEnv).mockReturnValue({ [name]: "file:///not-an-api" });
    expect(() => viteConfig({ command: "serve", mode: "test" })).toThrow(name);
  });

  it.each(["live", ""])("rejects mode %j before starting the server", (mode) => {
    vi.mocked(loadEnv).mockReturnValue({ VITE_DATA_SOURCE: mode });
    expect(() => viteConfig({ command: "serve", mode: "test" })).toThrow("VITE_DATA_SOURCE");
  });
});