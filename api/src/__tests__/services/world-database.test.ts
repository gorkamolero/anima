// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

it("keeps a configured QA world database separate from the saved world", async () => {
	const directory = mkdtempSync(join(tmpdir(), "anima-world-"));
	vi.stubEnv("ANIMA_WORLD_DB_URL", `file:${join(directory, "qa.db")}`);
	vi.resetModules();
	const { getWorldDb, openWorldDb } = await import("../../services/world.js");
	const qa = await getWorldDb();
	const other = await openWorldDb(`file:${join(directory, "other.db")}`);
	try {
		await qa.execute("INSERT INTO worlds VALUES ('qa-only', '{}')");
		expect(await getWorldDb()).toBe(qa);
		expect((await qa.execute("SELECT * FROM worlds")).rows).toHaveLength(1);
		expect((await other.execute("SELECT * FROM worlds")).rows).toHaveLength(0);
	} finally {
		qa.close();
		other.close();
		vi.unstubAllEnvs();
		vi.resetModules();
		rmSync(directory, { recursive: true, force: true });
	}
});
