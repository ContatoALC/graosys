import { defineConfig, devices } from "@playwright/test";

// Credenciais do usuário de teste (graosys-frontend/.env.e2e, fora do git).
try { process.loadEnvFile(".env.e2e"); } catch { /* sem arquivo: usa o ambiente */ }

const PORT = 5173;
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const AUTH_FILE = "playwright/.auth/superadmin.json";

export default defineConfig({
  testDir: "./tests",
  timeout: 5_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    actionTimeout: 5_000,
    navigationTimeout: 5_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Não precisam de login (nem de backend, exceto o teste de senha errada)
    { name: "public", testDir: "./tests/public", use: { ...devices["Desktop Chrome"] } },
    // Login uma vez e reaproveita a sessão
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "app",
      testDir: "./tests/app",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
    },
  ],
  webServer: {
    // No CI usa o build (mais rápido e igual à produção); local usa o Vite dev.
    command: process.env.CI
      ? `npm run build && npx vite preview --port ${PORT} --strictPort`
      : `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
