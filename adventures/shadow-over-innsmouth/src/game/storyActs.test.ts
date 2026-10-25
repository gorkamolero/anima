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
