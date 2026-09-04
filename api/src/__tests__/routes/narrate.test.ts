import { MockLanguageModelV2 } from "ai/test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
	createNarrateRoutes,
	narrateOptionsSchema,
	narrateResolveSchema,
} from "../../routes/narrate.js";

function testApp(output: unknown): Hono {
	const model = new MockLanguageModelV2({
		doGenerate: {
			content: [{ type: "text", text: JSON.stringify(output) }],
			finishReason: "stop",
			usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
			warnings: [],
		},
	});
	const app = new Hono();
	app.route("/api", createNarrateRoutes(model));
	return app;
}

const request = {
	scene: "outside",
	sceneDescription: "A salt-stained depot platform waits above the harbor.",
	object: "vending machine",
	flags: {},
};

describe("POST /api/narrate", () => {
	it("returns three validated options", async () => {
		const app = testApp({
			options: [
				"Listen for machinery behind its panel",
				"Inspect the coin return for salt",
				"Test whether its dark glass is warm",
			],
		});
		const response = await app.request("/api/narrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...request, mode: "options" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(narrateOptionsSchema.safeParse(body).success).toBe(true);
	});

	it("returns a validated resolution", async () => {
		const app = testApp({
			caption:
				"The machine caves inward with a metallic groan. Briny water beads across the cracked glass.",
			statePatch: { vendingMachineKicked: true },
			visual: {
				delta: "new",
				imagePrompt: "Dent the vending machine and crack its dark glass.",
			},
		});
		const response = await app.request("/api/narrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...request,
				choice: "I kick it as hard as I can",
				mode: "resolve",
			}),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(narrateResolveSchema.safeParse(body).success).toBe(true);
	});

	it("returns 400 when object is missing", async () => {
		const app = testApp({ options: ["One", "Two", "Three"] });
		const { object: _object, ...missingObject } = request;
		const response = await app.request("/api/narrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...missingObject, mode: "options" }),
		});

		expect(response.status).toBe(400);
	});
});
