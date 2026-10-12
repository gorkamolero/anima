// @vitest-environment node
import { createClient } from "@libsql/client";
import { expect, it } from "vitest";
import { createConnectionsRoutes } from "../../routes/connections.js";

it("persists reciprocal exits atomically and refuses to steal an occupied return", async () => {
	const db = createClient({ url: ":memory:" });
	const app = createConnectionsRoutes(db);
	const from = { scene: "outside", exit: "door", kind: "door" };
	const to = { scene: "inside", exit: "door", kind: "door" };
	const post = (a = from, b = to) =>
		app.request("http://localhost/connections", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from: a, to: b }),
		});
	expect((await post()).status).toBe(200);
	expect((await post()).status).toBe(200);
	expect(
		await (await app.request("http://localhost/connections/inside")).json(),
	).toEqual([{ ...to, to: "outside", entry: "door" }]);
	expect((await post({ ...from, exit: "other" })).status).toBe(409);
	expect(
		await (await app.request("http://localhost/connections/outside")).json(),
	).toEqual([{ ...from, to: "inside", entry: "door" }]);
	db.close();
});
