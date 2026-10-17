/** Scene URLs survive refresh and can be shared independently of a world session. */
export function readSceneRoute(url = window.location.href): string | undefined {
	const id = new URL(url).searchParams.get("scene");
	return id && /^(outside|inside|place-[a-f0-9]+)$/.test(id) ? id : undefined;
}

export function sceneUrl(id: string, current = window.location.href): string {
	const url = new URL(current);
	url.searchParams.set("scene", id);
	return url.href;
}

export function commitSceneRoute(id: string): void {
	if (readSceneRoute() === id) return;
	const method = readSceneRoute() ? "pushState" : "replaceState";
	window.history[method](null, "", sceneUrl(id));
}
