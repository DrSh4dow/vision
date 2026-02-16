import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	testMatch: "**/*.e2e.ts",
	fullyParallel: true,
	retries: 0,
	use: {
		baseURL: "http://localhost:3210",
		viewport: { width: 1536, height: 960 },
	},
	webServer: {
		command: "bunx vite --port 3210 --strictPort",
		url: "http://localhost:3210",
		cwd: ".",
		reuseExistingServer: true,
		timeout: 120000,
	},
});
