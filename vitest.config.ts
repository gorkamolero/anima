import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./packages/engine/src/__tests__/setup.ts"],
		include: ["packages/**/*.test.ts", "api/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["packages/engine/src/**/*.ts", "api/src/**/*.ts"],
			exclude: ["**/*.test.ts", "**/index.ts", "**/*.d.ts"],
		},
		typecheck: {
			enabled: true,
		},
	},
	resolve: {
		alias: {
			"@anima/engine": "/home/gorkolas/www/anima/packages/engine/src",
		},
	},
});
