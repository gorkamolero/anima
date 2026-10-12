// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), write: vi.fn() }));
vi.mock("node:child_process", () => ({
	execFileSync: () => Buffer.from("pixels"),
}));
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(),
	writeFile: mocks.write,
	readFile: vi.fn(async (path: string) => {
		if (path.endsWith(".png")) return Buffer.from("image");
		throw Error("ENOENT");
	}),
}));
vi.mock("ai", () => ({ generateObject: mocks.generate }));
vi.mock("../../lib/model.js", () => ({ getModel: () => "gemini" }));
beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());
it("sends typed image questions to Decisions and applies the inclusive threshold", async () => {
	const fetch = vi.fn(async () =>
		Response.json({
			answers: {
				environment: { noul: 0.6 },
				obstacles: { noul: 0.1 },
				coverage: { score: 1 },
			},
		}),
	);
	vi.stubGlobal("fetch", fetch);
	const { asymmetricFloorJudge } = await import(
		"../../services/floor-judge.js"
	);
	const result = await asymmetricFloorJudge("/proof/mask.png");
	expect(result.pass).toBe(false);
	expect(mocks.generate).not.toHaveBeenCalled();
	const body = JSON.parse(
		(fetch.mock.calls as unknown as Array<[string, { body: string }]>)[0][1]
			.body,
	);
	expect(body.model).toBe("openai/gpt-6-luna-decisions");
	expect(body.questions.environment.type).toBe("noul");
	expect(body.questions.coverage.type).toBe("score");
	expect(body.state.image.image_url.url).toMatch(/^data:image\/png;base64,/);
});
it("falls back on rejected image state with the same named questions and preserves evidence", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response("image rejected", { status: 400 })),
	);
	mocks.generate.mockImplementation(async () => ({
		object: {
			score: 0.1,
			yes: false,
			confidence: 0.9,
			evidence: "no water",
		},
	}));

	const { asymmetricFloorJudge } = await import(
		"../../services/floor-judge.js"
	);
	const result = await asymmetricFloorJudge("/proof/mask.png");
	expect(result.pass).toBe(true);
	expect(result.probabilities?.coverage).toBe(0.1);
	expect(result.probabilities?.obstacles).toBeUndefined();
	expect(result.probabilities?.environment).toBeCloseTo(0.1);
	expect(
		mocks.write.mock.calls.some(([, text]) =>
			String(text).includes("no water"),
		),
	).toBe(true);
	expect(mocks.generate).toHaveBeenCalledTimes(3);
	expect(JSON.stringify(mocks.generate.mock.calls)).toContain("Missing floor");
});
it("does not treat missing fallback answers as safe probabilities", async () => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(null, { status: 400 })),
	);
	mocks.generate.mockResolvedValue({
		object: { evidence: "missing probability" },
	});

	const { asymmetricFloorJudge } = await import(
		"../../services/floor-judge.js"
	);
	await expect(asymmetricFloorJudge("/proof/mask.png")).rejects.toThrow(
		"Invalid or missing probability",
	);
});
