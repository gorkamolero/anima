import { describe, expect, it } from "vitest";
import { act1Hotspots } from "./act1Hotspots";
import { createAct, storyPlace } from "./storyActs";

describe("authored act routes", () => {
	it("plays investigation to chase", () => {
		const { runtime: r } = createAct("2");
		r.start();
		for (const [id, v] of [
			["notebook", "USE"],
			["door", "USE"],
			["kat_figure", "TALK"],
			["library_direction", "USE"],
			["history_section", "USE"],
			["kat_library", "TALK"],
			["window", "USE"],
			["harbor_road", "USE"],
			["old_drunk", "TALK"],
			["town_direction", "USE"],
			["hotel_direction", "USE"],
			["front_door", "USE"],
		] as const)
			r.perform(id, v);
		expect(r.snapshot().choices).toHaveLength(2);
		r.choose(0);
		r.choose(1);
		expect(r.snapshot()).toMatchObject({
			ended: true,
			state: { flags: { knows_deep_ones: true, knows_kat_marsh: true } },
		});
	});
	it("plays the chase to its act end", () => {
		const { runtime: r } = createAct("3");
		r.start();
		for (const [id, v] of [
			["town_direction", "USE"],
			["alley", "USE"],
			["church_door", "USE"],
			["kat_altar", "TALK"],
			["road", "USE"],
			["truck", "USE"],
		] as const)
			r.perform(id, v);
		expect(r.snapshot()).toMatchObject({
			ended: true,
			state: { flags: { kat_goodbye: true } },
		});
	});
	it.each([false, true])("plays reef with noticed=%s", (noticed) => {
		const { runtime: r } = createAct("3b", noticed);
		r.start();
		r.perform("rowboat", "USE");
		r.perform("path_down", "USE");
		expect(r.snapshot().choices).toHaveLength(3);
		r.choose(0);
		if (noticed) {
			r.choose(3);
			r.perform("path_left", "USE");
			r.choose(0);
			r.choose(0);
			expect(r.snapshot().choices).toHaveLength(2);
			r.choose(0);
		} else r.choose(0);
		expect(r.snapshot()).toMatchObject({ ended: true, ending: "ACT_END" });
		if (noticed) expect(r.snapshot().state.flags.surface_path).toBe(true);
	});
	it.each([0, 1, 2])("plays beach choice %s", (choice) => {
		const { runtime: r } = createAct("4");
		r.start();
		r.perform("bed", "USE");
		r.perform("kat_dream", "TALK");
		r.perform("door", "USE");
		r.perform("kat_beach", "TALK");
		r.choose(choice);
		if (choice < 2) {
			r.perform("kat_walking", "TALK");
			r.perform("end", "USE");
		}
		expect(r.snapshot().ended).toBe(true);
	});
	it("gives every scene a place and every hotspot a clickable region", () => {
		for (const act of ["2", "3", "3b", "4"])
			for (const scene of createAct(act).graph.scenes) {
				expect(storyPlace(scene.originalId).location).toBeTruthy();
				const spots = act1Hotspots(scene, false);
				expect(spots.length).toBe(scene.hotspots.length);
				for (const h of spots) {
					expect(h.bounds.y).toBeGreaterThan(100);
					expect(h.bounds.x + h.bounds.width).toBeLessThanOrEqual(1920);
				}
			}
	});
});

it("covers all reef decisions, including revised rescue endings", () => {
	const cases = [
		{ side: "path_left", choices: [0, 0, 0], ending: "GAME_END_ABYSSAL" },
		{ side: "path_left", choices: [1, 0, 1, 0], ending: "GAME_END_ABYSSAL" },
		{ side: "path_left", choices: [2, 0, 1, 1], ending: "ACT_END" },
		{ side: "path_left", choices: [0, 1], ending: "ACT_END" },
		{ side: "path_left", choices: [0, 2, 0, 0], ending: "GAME_END_ABYSSAL" },
		{ side: "path_left", choices: [1, 2, 1], ending: "ACT_END" },
		{ side: "path_left", choices: [2, 2, 2], ending: "ACT_END" },
		{ side: "path_left", choices: [0, 3, 0, 0, 0], ending: "ACT_END" },
		{ side: "path_left", choices: [1, 3, 1, 1, 1], ending: "ACT_END" },
		{ side: "path_right", choices: [2, 3, 0, 0], ending: "ACT_END" },
		{ side: "path_right", choices: [0, 3, 0, 1], ending: "ACT_END" },
		{ side: "path_right", choices: [1, 3, 1, 0, 0], ending: "ACT_END" },
		{ side: "path_right", choices: [2, 3, 1, 1], ending: "ACT_END" },
	];
	for (const route of cases) {
		const { runtime: r } = createAct("3b", true);
		r.start();
		r.perform("rowboat", "USE");
		r.perform("path_down", "USE");
		for (const index of route.choices) {
			if (r.snapshot().scene?.originalId === "rescue_escape")
				r.perform(route.side, "USE");
			expect(r.snapshot().choices[index], JSON.stringify(route)).toBeDefined();
			r.choose(index);
		}
		expect(r.snapshot(), JSON.stringify(route)).toMatchObject({
			ended: true,
			ending: route.ending,
		});
	}
});

it("starts the next act with carried flags and inventory, at its own first scene", () => {
	const { runtime: r } = createAct("4", false, {
		scene: "ACT4_TRANSITION",
		inventory: ["notebook"],
		flags: {
			surface_path: true,
			kat_left_note: true,
			clerk_noticed_interest: true,
		},
	});
	expect(r.start()).toMatchObject({
		scene: { originalId: "one_year_later" },
		state: { inventory: ["notebook"], flags: { clerk_noticed_interest: true } },
	});
	r.perform("bed", "USE");
	r.perform("kat_dream", "TALK");
	r.perform("door", "USE");
	expect(r.perform("kat_beach", "TALK").output.join("\n")).toContain(
		"You said you were sorry.",
	);
});
