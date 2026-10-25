import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStoryScript, StoryRuntime, validateStoryGraph } from "./runtime";

const story = `
SCENE start
  location: "Start"
  DESCRIPTION
    A room.
  END
  ON_ENTER
    hero (thinks): "Wake up."
  END
  HOTSPOT door [1, 2, 3, 4]
    name: "Door"
    USE
      IF NOT HAS(key)
        "Locked."
      ELSE
        -> next
      END
    END
  END
  HOTSPOT key
    name: "Key"
    USE
      GIVE key
    END
  END
END

SCENE next
  location: "Next"
  DESCRIPTION
    Outside.
  END
END
`;

describe("StoryRuntime", () => {
	it("parses scenes and hotspots", () => {
		const graph = parseStoryScript(story);

		expect(graph.scenes).toHaveLength(2);
		expect(graph.scenes[0].hotspots[0]).toMatchObject({
			id: "door",
			name: "Door",
			bounds: { x: 1, y: 2, width: 3, height: 4 },
		});
		expect(validateStoryGraph(graph)).toEqual([]);
	});

	it("executes inventory-gated transitions", () => {
		const runtime = new StoryRuntime(parseStoryScript(story));

		expect(runtime.start().output).toContain("## Start");
		expect(runtime.perform("door", "USE").output).toContain("Locked.");
		expect(runtime.perform("key", "USE").state.inventory).toContain("key");

		const result = runtime.perform("door", "USE");
		expect(result.scene?.originalId).toBe("next");
		expect(result.output).toContain("## Next");
	});

	it("validates the authored full Innsmouth story", () => {
		const storyPath = existsSync(
			"../../adventures/shadow-over-innsmouth/story/full_game.story",
		)
			? "../../adventures/shadow-over-innsmouth/story/full_game.story"
			: "adventures/shadow-over-innsmouth/story/full_game.story";
		const fullGame = readFileSync(storyPath, "utf8");
		const graph = parseStoryScript(fullGame);

		expect(graph.scenes.length).toBeGreaterThan(20);
		expect(validateStoryGraph(graph)).toEqual([]);
	});
});

describe("Act 1 route", () => {
	const path = existsSync(
		"../../adventures/shadow-over-innsmouth/story/act1.story",
	)
		? "../../adventures/shadow-over-innsmouth/story/act1.story"
		: "adventures/shadow-over-innsmouth/story/act1.story";
	it("gates boarding, nested ticket choices, Kat flags and arrival", () => {
		const runtime = new StoryRuntime(
			parseStoryScript(readFileSync(path, "utf8")),
		);
		runtime.start();
		expect(runtime.perform("exit", "USE").state.scene).toBe("bus_station");
		expect(runtime.perform("ticket_window", "TALK").choices).toHaveLength(3);
		expect(runtime.choose(0).choices).toHaveLength(3);
		expect(runtime.choose(1).state).toMatchObject({
			inventory: ["bus_ticket"],
			flags: { clerk_warned: true },
		});
		expect(runtime.perform("bench", "TALK").output).toHaveLength(2);
		expect(runtime.perform("exit", "USE").state.scene).toBe("bus_interior");
		expect(runtime.perform("rest", "USE").output).toContain(
			"You should talk to her first.",
		);
		expect(runtime.perform("window", "LOOK").output).toContain(
			"Farmland. Stone walls. Normal New England.",
		);
		expect(runtime.perform("window", "LOOK").output).toContain(
			"Salt marsh now. Fog rolling in.",
		);
		expect(runtime.perform("kat", "TALK").choices).toHaveLength(3);
		expect(runtime.choose(1).state.flags).toMatchObject({
			talked_to_kat_bus: true,
			kat_revealed_family: true,
		});
		expect(runtime.perform("kat", "TALK").choices).toHaveLength(0);
		expect(runtime.perform("rest", "USE").state.scene).toBe(
			"innsmouth_streets",
		);
	});
});
