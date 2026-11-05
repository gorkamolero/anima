// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { LangfuseClient } from "@langfuse/client";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
afterEach(() => vi.unstubAllGlobals());
it("ships matching 6.1.1 SDKs and the v4 ingestion header in the installed exporter", () => {
	for (const name of ["client", "otel", "tracing"]) {
		const dist = dirname(require.resolve(`@langfuse/${name}`));
		expect(JSON.parse(readFileSync(resolve(dist, "../package.json"), "utf8")).version).toBe("6.1.1");
	}
	const dist = dirname(require.resolve("@langfuse/otel"));
	for (const file of ["index.mjs", "index.cjs"]) {
		expect(readFileSync(resolve(dist, file), "utf8")).toMatch(/"x-langfuse-ingestion-version":\s*"4"/);
	}
});
it("calls bound v6 dataset API methods with all HTTP requests stubbed", async () => {
	const fetch = vi.fn(async () => Response.json({ id: "dataset", name: "anima-floor-places" }));
	vi.stubGlobal("fetch", fetch);
	const client = new LangfuseClient({ publicKey: "test", secretKey: "test", baseUrl: "https://example.invalid" });
	try {
		await client.api.datasets.create({ name: "anima-floor-places" });
		await client.api.datasetItems.create({ datasetName: "anima-floor-places", id: "fixed-id", input: { snapshotId: "fixed-id" } });
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(String(fetch.mock.calls[0][0])).toContain("/datasets");
		expect(String(fetch.mock.calls[1][0])).toContain("/dataset-items");
	} finally { await client.shutdown(); }
});
