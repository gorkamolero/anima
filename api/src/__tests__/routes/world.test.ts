import type { Client } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { createWorldRoutes } from "../../routes/world.js";
import { openWorldDb } from "../../services/world.js";

let db: Client;
afterEach(() => db?.close());
describe("persistent world", () => {
	it("merges state, removes inventory, keeps visual state per location and the last twelve actions", async () => {
		db = await openWorldDb("file::memory:");
		const app = createWorldRoutes(db);
		const patch = (value: unknown) =>
			app.request("/world/test", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(value),
			});
		await patch({
			statePatch: {
				flags: { broke: true },
				inventory: { add: ["key", "coin"] },
				npcMemory: { kat: "saw damage" },
			},
			visualStatePatch: { damage: "broken" },
		});
		await patch({
			location: "inside",
			statePatch: { inventory: { remove: ["coin"] } },
		});
		for (let i = 0; i < 14; i++)
			await patch({
				action: { object: "door", choice: String(i), caption: "It waits." },
			});
		const world = await (await app.request("/world/test")).json();
		expect(world.location).toBe("inside");
		expect(world.visual.outside.damage).toBe("broken");
		expect(world.visual.inside.damage).toBe("intact");
		expect(world.inventory).toEqual(["key"]);
		expect(world.npcMemory.kat).toBe("saw damage");
		expect(world.flags.broke).toBe(true);
		expect(world.history).toHaveLength(12);
		expect(world.history[0].choice).toBe("2");
		expect((await patch({ inventory: "bad" })).status).toBe(400);
		expect((await app.request("/world/other")).status).toBe(200);
	});
});
