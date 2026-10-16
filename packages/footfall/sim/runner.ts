import type { FootCycle, FootPose } from "../core/characters/footLock";
import { beginArrival, resolveReturnExit } from "../core/occlusion/arrivals";
import { exitAt, exitForFrame } from "../core/occlusion/exits";
import { depthForOccluder } from "../core/occlusion/occlusion";
import { findPath } from "../core/walkarea/navigation";
import {
	objectApproach,
	objectFacingPoint,
} from "../core/walkarea/objectApproach";
import { objectAtPoint } from "../core/walkarea/objectHit";
import type { Point } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";
import { CharacterMotor } from "../phaser/CharacterMotor";
import { captureSteps } from "./captureClock";
import type { LoggedOccluder, SceneRecord, SimulationOptions } from "./types";
/** Shared virtual-clock runner. All scene, asset and output I/O is injected. */
export async function simulateWalks({
	scenes,
	selected = [],
	sheets,
	animation,
	initialTexture,
	loadWalkRecords,
	storedOptions,
	Fade,
	save,
	out = "",
	extraOccluders = () => [],
	immediateLocations = [],
}: SimulationOptions) {
	const cycles = new Map<string, FootCycle>();
	const cycle = (name: string): FootCycle => {
		let value = cycles.get(name);
		if (!value) {
			value = { ...sheets(name), name } as FootCycle;
			cycles.set(name, value);
		}
		return value;
	};
	const began = performance.now();
	const results = [];
	const catalog: Record<string, SceneRecord["objects"]> = {};
	for (const scene of Object.keys(scenes)) {
		const { location: sourceLocation, plan } = scenes[scene];
		const sourceGeometry = loadWalkRecords(sourceLocation);
		const dir = `${out}/${scene}`;
		save(`${dir}/navigation.json`, sourceGeometry);
		save(`${dir}/plan.json`, plan);
		const areas: Record<string, WalkArea> = {};
		const remember = (geometry: SceneRecord) => {
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
				cycle: cycle(initialTexture),
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
					animation(
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
				events: unknown[] = [],
				limitations: string[] = [];
			let frame = -1,
				idle = 0,
				planningMs = 0;
			const fade = new Fade({ emit() {}, scene: {} });
			let fadeStarted = false;
			const emit = (data: unknown) =>
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
			const walk = (path: Point[], after?: () => void | Promise<void>) => {
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
					? async () => {
							if (transfer) return;
							object = interactable.name;
							busy = true;
							await motor.facePoint(objectFacingPoint(interactable));
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
							} finally {
								busy = false;
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
							if (immediateLocations.includes(resolved.to))
								location = resolved.to;
						}
					}
				}
				const katOccluders = extraOccluders(geometry);
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
						.map<LoggedOccluder>((o) => ({
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
					if (!immediateLocations.includes(travel.exit.to as string)) {
						if (!fadeStarted) {
							location = travel.exit.to as string;
							fade.start(true, 250, 0, 0, 0, true);
							fadeStarted = true;
							continue;
						}
						if (fade.isRunning) continue;
					}
					try {
						motor.detach();
						await Promise.resolve();
						geometry = loadWalkRecords(travel.exit.to as string);
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
	return report;
}
