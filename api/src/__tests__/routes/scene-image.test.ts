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
		const filename = sceneImageCacheName("outside", imagePrompt);
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
			body: JSON.stringify({ scene: "outside", imagePrompt }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			url: `http://localhost/generated/${filename}`,
		});
		expect(editImage).not.toHaveBeenCalled();
	});
});
