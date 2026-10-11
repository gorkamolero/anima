// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createSceneImageRoutes,
	sceneImageCacheName,
} from "../../routes/scene-image.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("POST /api/scene-image", () => {
	it("returns a disk cache hit without calling fal", async () => {
		const directory = await mkdtemp(join(tmpdir(), "anima-scene-image-"));
		temporaryDirectories.push(directory);
		const generatedDirectory = join(directory, "generated");
		await mkdir(generatedDirectory);
		const imagePrompt = "Dent the vending machine and crack its glass.";
		const visualState = {
			timeOfDay: "day",
			weather: "fog",
			damage: "dented",
			npcsPresent: [],
		};
		const baseBackground = "/backgrounds/test.png";
		const filename = sceneImageCacheName(
			"outside",
			visualState,
			baseBackground,
		);
		await writeFile(join(generatedDirectory, filename), "cached image");
		const editImage = vi.fn();
		const app = createSceneImageRoutes({
			generatedDirectory,
			backgrounds: { outside: join(directory, "unused.png") },
			editImage,
		});

		const response = await app.request("/scene-image", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scene: "outside",
				imagePrompt,
				visualState,
				baseBackground,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			url: `http://localhost/generated/${filename}`,
			cached: true,
		});
		expect(editImage).not.toHaveBeenCalled();
	});
});

it("canonicalizes NPC order while separating visual states and base art", () => {
	const state = {
		timeOfDay: "day",
		weather: "fog",
		damage: "intact",
		npcsPresent: ["kat", "clerk"],
	};
	const key = sceneImageCacheName("outside", state, "base");
	expect(
		sceneImageCacheName(
			"outside",
			{ ...state, npcsPresent: ["clerk", "kat"] },
			"base",
		),
	).toBe(key);
	expect(
		sceneImageCacheName("outside", { ...state, damage: "broken" }, "base"),
	).not.toBe(key);
	expect(sceneImageCacheName("outside", state, "new base")).not.toBe(key);
});
