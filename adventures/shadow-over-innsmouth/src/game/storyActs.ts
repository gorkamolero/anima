import { parseStoryScript, StoryRuntime } from "@anima/storyscript";
import act1 from "../../story/act1.story?raw";
import act2 from "../../story/act2.story?raw";
import act3 from "../../story/act3.story?raw";
import reef from "../../story/act3b_devil_reef.story?raw";
import act4 from "../../story/act4.story?raw";

export function createAct(act: string, noticed = false) {
	const source =
		(
			{
				"1": act1,
				"2": act2,
				"3": `${act3}\n${reef}`,
				"3b": reef,
				"4": act4,
			} as Record<string, string>
		)[act] ?? act1;
	const graph = parseStoryScript(source);
	// The reef author appended revised endings under the same names. Last definition wins.
	graph.scenes = graph.scenes.filter(
		(s, i, all) =>
			!all.slice(i + 1).some((next) => next.originalId === s.originalId),
	);
	const endTargets =
		act === "2" ? ["chase_begins"] : ["ACT_END", "one_year_later"];
	return {
		graph,
		runtime: new StoryRuntime(
			graph,
			{ flags: { clerk_noticed_interest: noticed } },
			endTargets,
		),
	};
}

const locations: Record<string, string> = {
	bus_station: "inside",
	bus_interior: "inside",
	innsmouth_streets: "place-d3fc732744430e25f7c1",
	town_square: "place-0be8458a1e434dd7ee9e",
	grocery_store: "place-045884673aa9e212d400",
	hotel_lobby: "place-7672fad03a2b6c668284",
	hotel_lobby_evening: "place-7672fad03a2b6c668284",
	harbor: "place-2a19481aac649a2e69f1",
	chase_begins: "place-2a19481aac649a2e69f1",
	pier_meeting: "place-96acfd3d8faaf8f903fe",
	street_chase: "place-2635d8cd03bce818a634",
	church_escape: "place-e3110e2fd21ee4e07819",
	church_interior: "place-15965c132f18663902c3",
	escape_road: "place-f2d0a7f7f76225002663",
	drive_to_beach: "place-f2d0a7f7f76225002663",
	the_beach: "place-a53d08124ed6c715c32e",
	the_end: "place-a53d08124ed6c715c32e",
	epilogue: "place-a53d08124ed6c715c32e",
};
export function storyPlace(id: string) {
	const location = locations[id];
	const pendingArt =
		id === "bus_interior"
			? "bus interior pending"
			: location
				? undefined
				: `${id.replace(/_/g, " ").toLowerCase()} pending`;
	return { location: location ?? "inside", pendingArt };
}
