#!/usr/bin/env tsx
/** Run from repository root with api/node_modules/.bin/tsx.
 * Scene I/O is supplied by read-only stored records. Motion, geometry, object
 * approaches, exit guards/arrivals and fake-clock subdivision are production code.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type {
	FootCycle,
	FootPose,
} from "@anima/footfall/core/characters/footLock";
import {
	beginArrival,
	resolveReturnExit,
} from "@anima/footfall/core/occlusion/arrivals";
import { exitAt, exitForFrame } from "@anima/footfall/core/occlusion/exits";
import { depthForOccluder } from "@anima/footfall/core/occlusion/occlusion";
import { findPath } from "@anima/footfall/core/walkarea/navigation";
import {
	objectApproach,
	objectFacingPoint,
} from "@anima/footfall/core/walkarea/objectApproach";
import { objectAtPoint } from "@anima/footfall/core/walkarea/objectHit";
import { CharacterMotor } from "@anima/footfall/phaser/CharacterMotor";
import { captureSteps } from "@anima/footfall/sim/captureClock";
import { loadWalkRecords, storedOptions } from "./walk-records.mts";

const { hermesFootAnimation } = createRequire(import.meta.url)(
	"../src/game/scenes/hermesFootAnimation.ts",
) as typeof import("../src/game/scenes/hermesFootAnimation.ts");
// Phaser's actual camera clock has no DOM dependency. Keep its completion and
// floating-point timing identical while supplying only its event interface.
const Fade = createRequire(import.meta.url)(
	"phaser/src/cameras/2d/effects/Fade.js",
);
const arg = (name: string, fallback: string) =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback;
const corpus = arg("corpus", "tmp/walkqa/harness-24");
const out = resolve("tmp/walkqa/sim", arg("run", "26-current"));
const scenes = arg(
	"scenes",
	"outside,inside,road,alley,pier,stepped-street,church,lobby,grocery,square",
).split(",");
const selected = arg("walks", "").split(",").filter(Boolean);
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const save = (path: string, value: unknown) =>
	writeFileSync(path, JSON.stringify(value));
const assets = resolve(
	"adventures/shadow-over-innsmouth/public/assets/sprites/hermes",
);
const cycles = new Map<string, FootCycle>();
const cycle = (name: string): FootCycle => {
	let value = cycles.get(name);
	if (!value) {
		value = { ...json(`${assets}/${name}.json`), name } as FootCycle;
		cycles.set(name, value);
	}
	return value;
};
const began = performance.now(),
	results = [],
	catalog = {};
for (const scene of scenes) {
	const root = `${corpus}/${scene}`,
		fixture = json(`${root}/navigation.json`);
	const sourceGeometry = loadWalkRecords(fixture.location),
		plan = json(`${root}/plan.json`);
	const dir = `${out}/${scene}`;
	mkdirSync(dir, { recursive: true });
	save(`${dir}/navigation.json`, sourceGeometry);
	save(`${dir}/plan.json`, plan);
	const areas = {};
	const remember = (geometry) => {
		areas[geometry.location] = {
			...geometry.area,
			mask: geometry.area.rawMask ?? geometry.area.mask,
		};
		catalog[geometry.location] = geometry.objects;
	};
	remember(sourceGeometry);
	for (const beat of plan.beats) {
		if (selected.length && !selected.includes(beat.name)) continue;
		let geometry = sourceGeometry,
			location = geometry.location;
		let pose: FootPose = {
			cycle: cycle("hermes-passing-stand-side"),
			frame: 0,
			flipX: true,
		};
		const sprite = {
			x: 0,
			y: 0,
			scale: 1,
			depth: 0,
			setPosition(x: number, y: number) {
				this.x = x;
				this.y = y;
			},
			setScale(value: number) {
				this.scale = value;
			},
			setDepth(value: number) {
				this.depth = value;
			},
		};
		const makeMotor = () =>
			new CharacterMotor(
				sprite,
				geometry.area,
				() => {},
				hermesFootAnimation(
					cycle,
					() => pose,
					(p) => {
						pose = p;
					},
				),
			);
		let motor = makeMotor();
		const searches = new Set<
			NonNullable<ReturnType<CharacterMotor["snapshot"]>["plan"]["search"]>
		>();
		motor.heading = "right";
		motor.place({ x: beat.start[0], y: beat.start[1] });
		let blocked = false,
			visible = true,
			busy = false,
			arriving = false,
			object: string | undefined,
			requested: string | undefined,
			latch: string | undefined;
		let transfer:
			| { from: string; exit: (typeof geometry.exits)[number] }
			| undefined;
		const rows = [],
			events = [],
			limitations: string[] = [];
		let frame = -1,
			idle = 0,
			planningMs = 0;
		const fade = new Fade({ emit() {}, scene: {} });
		let fadeStarted = false;
		const emit = (data) =>
			events.push({
				frame,
				type: "emitOpenWorldState",
				data,
				location,
				walking: motor.walking,
			});
		const clicked = {
			x: Math.floor(beat.click[0]),
			y: Math.floor(beat.click[1]),
		};
		const exit = exitAt(clicked, geometry.exits);
		const interactable = exit
			? undefined
			: objectAtPoint(
					geometry.interactables,
					geometry.layers,
					geometry.visible,
					clicked.x,
					clicked.y,
					1920,
					1080,
				);
		requested = exit?.id;
		const route = interactable
			? objectApproach(
					geometry.area,
					sprite,
					geometry.objects,
					interactable,
					clicked.x,
				)
			: findPath(geometry.area.mask, sprite, exit?.approach ?? clicked);
		const setup = {
			start: { x: sprite.x, y: sprite.y },
			startAnchor: { ...motor.anchor },
			target: clicked,
			preview: route.map((p) => ({ x: p.x, y: p.y })),
			reachableTarget: { x: route.at(-1)?.x, y: route.at(-1)?.y },
			actualReachableTarget: { x: route.at(-1)?.x, y: route.at(-1)?.y },
			exits: geometry.exits,
		};
		const walk = (path, after?: () => void) => {
			blocked = true;
			const start = performance.now();
			void motor.walk(path).then(() => {
				blocked = false;
				after?.();
			});
			planningMs += performance.now() - start;
		};
		walk(
			route,
			interactable
				? () => {
						if (transfer) return;
						object = interactable.name;
						motor.facePoint(objectFacingPoint(interactable));
						emit({ status: "loading", object });
						try {
							emit({
								status: "options",
								object,
								options: storedOptions(location, object),
							});
						} catch (error) {
							limitations.push(String(error));
							emit({ status: "error", message: String(error) });
						}
					}
				: undefined,
		);
		await Promise.resolve();
		for (frame = 0; frame < 2400; frame++) {
			for (const delta of captureSteps(1000 / 24)) {
				fade.update(0, delta);
				const wasWalking = motor.walking;
				motor.update(delta);
				const state = exitForFrame({
					anchor: motor.anchor,
					exits: geometry.exits,
					requested,
					latch,
					arrival: motor.arrival,
					wasWalking,
					approachingObject: !!interactable && !object,
					arriving,
					busy,
				});
				latch = state.latch;
				if (state.trigger) {
					const found = state.trigger;
					latch = found.id;
					events.push({
						frame,
						type: "triggerExit",
						data: found,
						location,
						walking: motor.walking,
					});
					motor.stop();
					const primary = found.kind.startsWith("edge-")
						? geometry.exits.find((e) => e.kind === found.kind)
						: undefined;
					const resolved = primary
						? { ...found, id: primary.id, to: primary.to }
						: found;
					if (!resolved.to) {
						limitations.push(
							`Unconnected exit ${location}/${resolved.id}: requires cached narrative resolution`,
						);
						emit({ status: "error", message: limitations.at(-1) });
						requested = undefined;
					} else {
						transfer = { from: location, exit: resolved };
						visible = false;
						busy = true;
						if (resolved.to === "outside" || resolved.to === "inside")
							location = resolved.to;
					}
				}
			}
			const kat = geometry.kat;
			const katOccluders = kat
				? [
						{
							id: "kat-seated-talk-loop",
							depth: 10 + kat.y / 20,
							baseline: [
								{ x: kat.x - 410 * kat.scale, y: kat.y },
								{ x: kat.x + 410 * kat.scale, y: kat.y },
							],
							bounds: {
								x: kat.x - 410 * kat.scale,
								y: kat.y - 880 * kat.scale,
								width: 820 * kat.scale,
								height: 880 * kat.scale,
							},
							sprite: {
								texture: "kat-seated-talk-loop",
								cutX: 0,
								cutY: 0,
								width: 820,
								height: 880,
								flip: kat.flipX ?? false,
							},
						},
					]
				: [];
			const state = motor as unknown as {
				path: { x: number; y: number }[];
				goal?: { x: number; y: number };
			};
			const search = motor.snapshot().plan.search;
			if (search) searches.add(search);
			const row = {
				t: frame / 24,
				visible,
				x: sprite.x,
				y: sprite.y,
				scale: sprite.scale,
				flip: pose.flipX,
				texture: pose.cycle.name,
				frame: pose.frame,
				walking: motor.walking,
				contact: motor.snapshot(),
				path: state.path,
				target: state.goal ?? null,
				location,
				ui: busy,
				inputBlocked: blocked,
				arriving,
				object,
				depth: sprite.depth,
				occluders: geometry.objects
					.map((o) => ({
						id: o.id,
						depth: 10 + depthForOccluder(o, motor.anchor.x) / 20 - 0.001,
						floorDecal: o.floorDecal,
						baseline: o.baseline,
						bounds: {
							x: o.bbox.x,
							y: o.bbox.y,
							width: o.bbox.w,
							height: o.bbox.h,
						},
					}))
					.concat(katOccluders),
			};
			rows.push(row);
			for (let n = 0; n < 5; n++) await Promise.resolve();
			if (transfer) {
				const travel = transfer;
				if (travel.exit.to !== "outside" && travel.exit.to !== "inside") {
					if (!fadeStarted) {
						location = travel.exit.to;
						fade.start(true, 250, 0, 0, 0, true);
						fadeStarted = true;
						continue;
					}
					if (fade.isRunning) continue;
				}
				try {
					motor.detach();
					await Promise.resolve();
					geometry = loadWalkRecords(travel.exit.to);
					location = geometry.location;
					remember(geometry);
					motor = makeMotor();
					const entry = resolveReturnExit(
						geometry.area,
						geometry.exits,
						geometry.connections,
						travel,
						1064,
					);
					const path = beginArrival(
						motor,
						geometry.area,
						entry.entry,
						entry.kind,
						1064,
					);
					latch = entry.entry.id;
					requested = undefined;
					arriving = true;
					walk(path, () => {
						arriving = false;
					});
					visible = true;
					busy = false;
				} catch (error) {
					limitations.push(String(error));
					emit({ status: "error", message: String(error) });
					busy = false;
					visible = true;
				}
				transfer = undefined;
				fadeStarted = false;
				await Promise.resolve();
			}
			idle =
				!row.walking &&
				!row.contact.plan.pending &&
				!row.ui &&
				!row.arriving &&
				!row.inputBlocked
					? idle + 1
					: 0;
			if (idle >= 12 && frame >= 27) break;
		}
		save(`${dir}/${beat.name}.json`, rows);
		save(`${dir}/${beat.name}-events.json`, {
			beat,
			setup,
			events,
			completed: idle >= 12,
			limitations,
		});
		const rejections: Record<string, number> = {};
		for (const search of searches)
			for (const [reason, count] of Object.entries(search.rejections ?? {}))
				rejections[reason] = (rejections[reason] ?? 0) + count;
		save(`${dir}/${beat.name}-rejections.json`, {
			searches: [...searches],
			rejections,
		});
		results.push({
			scene,
			walk: beat.name,
			frames: rows.length,
			planningMs,
			search: motor.snapshot().plan.search,
			searches: [...searches],
			rejections,
			arrival: motor.arrival,
			limitations,
		});
	}
	save(`${dir}/area.json`, {
		...sourceGeometry,
		area: areas[sourceGeometry.location],
		areas,
	});
}
const report = {
	status: "requires-final-browser-confirmation",
	elapsedMs: performance.now() - began,
	walks: results.length,
	results,
};
save(`${out}/occluder-catalog.json`, catalog);
save(`${out}/run.json`, report);
console.log(
	JSON.stringify({ out, walks: results.length, elapsedMs: report.elapsedMs }),
);
