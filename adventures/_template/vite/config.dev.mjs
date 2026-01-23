import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss()],
	base: "./",
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					phaser: ["phaser"],
				},
			},
		},
	},
	server: {
		port: 8080,
		host: true,
		hmr: false,
		allowedHosts: ["raspgorkpi.drake-halosaur.ts.net", "100.73.125.61"],
	},
});
