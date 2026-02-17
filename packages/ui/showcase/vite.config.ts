import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const showcaseDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	plugins: [react()],
	root: path.resolve(showcaseDir),
	resolve: {
		alias: {
			"@": path.resolve(showcaseDir, "../src"),
		},
	},
	build: {
		outDir: path.resolve(showcaseDir, "../dist-showcase"),
		emptyOutDir: true,
	},
});
