import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../..",
);
export const PUBLIC = resolve(ROOT, "adventures/shadow-over-innsmouth/public");
export const ANCHORS: Record<string, string> = {
	outside: "/backgrounds/bus-station-flat-v1.png",
	inside: "/backgrounds/arkham-bus-depot-flat-2d.png",
};
export function imagePath(image: string): string {
	const path = image.startsWith("http") ? new URL(image).pathname : image;
	if (!/^\/(backgrounds|generated)\/[a-zA-Z0-9_-]+\.png$/.test(path))
		throw new Error("Invalid background path");
	return resolve(PUBLIC, `.${path}`);
}
