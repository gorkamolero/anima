import { MockLanguageModelV2 } from "ai/test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModel } from "../../lib/model.js";
import {
	createNarrateRoutes,
	narrateOptionsSchema,
	narrateResolveSchema,
	rememberVisibleChange,
} from "../../routes/narrate.js";
import { createWorldRoutes } from "../../routes/world.js";
import { getWorldDb, openWorldDb } from "../../services/world.js";

vi.mock("../../lib/model.js", () => ({ getModel: vi.fn() }));

vi.mock("../../services/world.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../services/world.js")>()),
	getWorldDb: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

function testApp(output: unknown): Hono {
	const model = new MockLanguageModelV2({
		doGenerate: {
			content: [{ type: "text", text: JSON.stringify(output) }],
			finishReason: "stop",
			usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
			warnings: [],
		},
	});
	vi.mocked(getModel).mockReturnValue(model);
	const app = new Hono();
	app.route("/api", createNarrateRoutes());
	return app;
}

const request = {
	scene: "outside",
	sceneDescription: "A salt-stained depot platform waits above the harbor.",
	object: "vending machine",
	flags: {},
};

describe("POST /api/narrate", () => {
	it("keeps uncached walking-preview interactions offline and unchanged", async () => {
		vi.stubEnv("ANIMA_NARRATION_CACHE_ONLY", "1");
		try {
			const app = new Hono();
			app.route("/api", createNarrateRoutes());
			for (const mode of ["options", "resolve"]) {
				const response = await app.request("/api/narrate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...request,
						mode,
						...(mode === "resolve" ? { choice: "Look closer" } : {}),
					}),
				});
				expect(response.status).toBe(200);
				const result = await response.json();
				if (mode === "options")
					expect(narrateOptionsSchema.safeParse(result).success).toBe(true);
				else {
					expect(narrateResolveSchema.safeParse(result).success).toBe(true);
					expect(result.statePatch).toEqual({});
					expect(result.visual).toEqual({ delta: "none" });
					expect(result.travel).toBeUndefined();
				}
			}
			expect(getModel).not.toHaveBeenCalled();
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("keeps painted and untouched pictures distinct even when the model says intact", () => {
		const painted = rememberVisibleChange({
			caption: "A red spiral marks the door.",
			statePatch: {},
			visual: { delta: "new", imagePrompt: "Paint a red spiral on the door." },
			visualStatePatch: { damage: "intact" },
		});
		expect(painted.visualStatePatch?.damage).toContain("red spiral");
		const observed = rememberVisibleChange(
			{
				caption: "The door waits.",
				statePatch: {},
				visual: { delta: "none" },
				visualStatePatch: { damage: "intact" },
			},
			painted.visualStatePatch?.damage,
		);
		expect(observed.visualStatePatch).toEqual({});
	});
	it("accepts optional partial patches and anchor travel in the public contract", () => {
		const value = {
			caption: "The door stands open.",
			statePatch: {},
			visual: { delta: "none" },
			travel: { to: "inside", kind: "anchor" },
		};
		expect(narrateResolveSchema.safeParse(value).success).toBe(true);
		expect(
			narrateResolveSchema.safeParse({
				...value,
				visualStatePatch: { weather: "rain" },
			}).success,
		).toBe(true);
	});

	it("shares narrator results across identical worlds and invalidates on remembered state", async () => {
		const db = await openWorldDb("file::memory:");
		vi.mocked(getWorldDb).mockResolvedValue(db);
		try {
			const app = testApp({
				options: ["Inspect the door", "Look at the lock", "Listen at the door"],
			});
			app.route("/api", createWorldRoutes(db));
			const ask = (sessionId: string) =>
				app.request("/api/narrate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...request, mode: "options", sessionId }),
				});
			expect((await ask("a")).status).toBe(200);
			expect((await ask("b")).status).toBe(200);
			expect(getModel).toHaveBeenCalledTimes(1);
			await app.request("/api/world/b", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					statePatch: {
						inventory: { add: ["key"] },
						npcMemory: { kat: "remembers the spiral" },
					},
				}),
			});
			expect((await ask("b")).status).toBe(200);
			expect(getModel).toHaveBeenCalledTimes(2);
		} finally {
			db.close();
		}
	});
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
		expect(getModel).toHaveBeenCalledOnce();
		expect(narrateOptionsSchema.safeParse(body).success).toBe(true);
	});

	it("returns a validated resolution", async () => {
		const app = testApp({
			caption:
				"The machine caves inward with a metallic groan. Briny water beads across the cracked glass.",
			statePatch: {
				flags: { vendingMachineKicked: true },
				inventory: { add: ["glass"] },
				npcMemory: { clerk: "heard the crash" },
			},
			visualStatePatch: {
				timeOfDay: "day",
				weather: "fog",
				damage: "vending machine dented",
				npcsPresent: [],
			},
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
		expect(getModel).toHaveBeenCalledOnce();
		expect(narrateResolveSchema.safeParse(body).success).toBe(true);
	});

	it.each([
		{
			mode: "options",
			output: { options: ["Inspect the panel", "Listen carefully"] },
		},
		{
			mode: "resolve",
			output: {
				caption: "Smoke rises from the machine.",
				statePatch: {},
				visual: { delta: "new" },
			},
		},
	])("rejects invalid $mode model output", async ({ mode, output }) => {
		const app = testApp(output);
		const response = await app.request("/api/narrate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...request, mode }),
		});

		expect(response.status).toBe(502);
		expect(await response.json()).toHaveProperty("error");
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
		expect(getModel).not.toHaveBeenCalled();
	});
});
