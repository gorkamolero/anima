# Brief: Open-World Innsmouth, proof of concept

Repo: `/Users/gorkolas/www/anima` (pnpm monorepo). Do all work on a branch off `main` named `open-world-mvp`. Do not commit the large uncommitted working tree that is already there; only stage the files you create or edit for this brief. Git identity: `gorkamolero <gorkamolero@users.noreply.github.com>`.

Read first: `CLAUDE.md`, `docs/OPEN-WORLD.md` (the full design; this brief is the minimum slice of it), `docs/AGENT-PLAYTESTING.md`.

## The claim to prove

Click anywhere on a real scene, say anything, and the world visibly changes while Hermes still walks on it. One scene, one narrator route, one image edit. Nothing else.

## Out of scope (do not build)

Turso, prefetch, simulated player swarm, anchor bake, TTS, ambience, video, a second location, segmentation masks, derived groundlines. All of these are in `docs/OPEN-WORLD.md` for later.

## Existing pieces you build on

- `api/` is a Hono server (`api/src/index.ts`, routes in `api/src/routes/game.ts`, tests in `api/src/__tests__/`). Add a route file, mount it the same way.
- The playable scene is `adventures/shadow-over-innsmouth/src/game/scenes/StoryGameScene.ts` using scene data from `standaloneScenes.ts` (`REVIEW_SCENES.outside`: background `bus-station-kat-seated`, calibrated groundline, Hermes walks). Keep that scene; extend it.
- Every scene installs `window.__anima` (`packages/engine/src/debug/AgentDebug.ts`): `step(ms)`, `click(x,y)`, `snapshot()`, `waitUntil(pred)`. Use it to verify, never synthetic PointerEvents.
- Art style prompt: `adventures/shadow-over-innsmouth/ART-STYLE.md`. Put its palette and style paragraph into every image prompt.
- Narrator source material lives in the sibling repo `/Users/gorkolas/www/the-pulse`:
  - story guide: `packages/core/ai/stories/shadow-over-innsmouth-non-linear.ts` (the `storyGuide` string)
  - agency rules: `packages/core/ai/prompts/mechanical.ts` (the "Player Agency", "Invitation Architecture", "Turn Reasoning" sections) and `docs/the-fourth-wall.md`
  Copy the text into anima; do not import across repos.

## Deliverables

### 1. Narrator route: `POST /api/narrate`

File: `api/src/routes/narrate.ts`. Use the Vercel AI SDK (`ai` + `@ai-sdk/google` or the gateway, whichever key is in `.env`; read `.env.example` and add what you need). Use `generateObject` with a zod schema.

Request:
```ts
{
  scene: string;            // "outside"
  sceneDescription: string; // one paragraph, from the scene data
  object: string;           // "vending machine"
  choice?: string;          // chosen option text, or free text
  flags: Record<string, string | boolean>;
  mode: "options" | "resolve";
}
```

Response (`mode: "options"`): `{ options: [string, string, string] }`. Three grounded outcomes for that object, written as invitations, each under 15 words.

Response (`mode: "resolve"`):
```ts
{
  caption: string;                      // 1–4 sentences. Describes TO Hermes, never FOR him.
  statePatch: Record<string, string | boolean>;
  visual: {
    delta: "none" | "new";
    imagePrompt?: string;               // only when "new": an EDIT instruction for the current background,
                                        // e.g. "the vending machine is dented and dark, glass cracked"
  };
}
```

System prompt = story guide + agency rules + one paragraph telling the model it is the narrator of a point-and-click scene, that most actions should resolve as `delta: "none"`, and that `imagePrompt` must describe a change to the existing picture, not a new picture, keeping composition, camera and ground unchanged.

Test: `api/src/__tests__/routes/narrate.test.ts`. Mock the model (the AI SDK ships `MockLanguageModelV2` in `ai/test`). One test per mode asserting the response validates against the schema and that a 400 comes back for a missing `object`. No more tests than that.

### 2. Click anywhere: labeled boxes per background

File: `api/src/routes/interactables.ts`, `GET /api/interactables/:sceneId`.

On first call, send the background PNG (`adventures/shadow-over-innsmouth/public/assets/backgrounds/<name>.png`, find the exact path) to a vision model (Gemini via the AI SDK is fine) asking for up to 12 named objects with normalized bounding boxes `[x0,y0,x1,y1]` in 0–1. Write the result to `<background>.interactables.json` beside the image and return it. On later calls return the file. That is the whole cache.

### 3. Image edit on `delta: "new"`

File: `api/src/routes/scene-image.ts`, `POST /api/scene-image` with `{ scene, imagePrompt }`.

Use `@fal-ai/client` (already a dependency in `packages/sprite-tools`; add it to `api`) with `fal-ai/nano-banana-2/edit` (check the current model id on fal.ai docs; if the edit endpoint has a different name, use the nano-banana-2 image-to-image edit variant). Input: the current background image plus `imagePrompt` plus the ART-STYLE paragraph plus "keep composition, camera angle, horizon and ground exactly as in the input image". Output: save to `adventures/shadow-over-innsmouth/public/generated/<sha1(scene+imagePrompt)>.png` and return `{ url }`. If the file exists, return it without calling fal.

No test for this route beyond a smoke check that a cache hit does not call fal (mock the client).

### 4. Wire it into the scene

In `StoryGameScene.ts` (or a thin new scene class if that is cleaner, but keep the same background and groundline):

- On load, fetch `/api/interactables/outside`. Draw nothing; on hover over a box, show its name in the existing speech/caption UI.
- On click inside a box: call `/api/narrate` with `mode: "options"`. Show the three options plus a text input in the existing React UI (`GameUI.tsx`) — plain buttons and an input, no new component library.
- On choose: call `mode: "resolve"`. Show the caption. Apply `statePatch` to the runtime flags. If `visual.delta === "new"`, call `/api/scene-image`, then swap the background texture to the returned URL with the existing fade transition. Groundline and Hermes placement stay as they are.
- Free-text input goes through as `choice` unchanged.

Do not touch the story files or the StoryScript runtime.

## Verification (must pass before you stop)

1. `pnpm lint`, `pnpm typecheck`, `pnpm --filter api test` all clean. Zero warnings.
2. With `pnpm dev` running, drive one journey with `window.__anima` from a script in `adventures/shadow-over-innsmouth/scripts/` (look at the existing `playtest` script there for the pattern): click the vending machine box, choose the free-text "I kick it as hard as I can", assert the caption appeared, assert the background texture key changed, assert Hermes can still walk to another point on the groundline (use `snapshot()` before and after). Capture a frame before and after with `captureFrame()` and save both PNGs to `tmp/open-world-mvp/`.
3. Record in the PR description: the caption the model produced, the image prompt, the two frames, and the wall-clock time of the image edit call.

## Constraints

- pnpm only. No new UI libraries. No new abstractions: one file per route, plain functions.
- Mark deliberate shortcuts with a `// ponytail:` comment naming the ceiling (e.g. `// ponytail: disk cache, Turso when more than one machine`).
- If fal's nano-banana-2 edit endpoint is unavailable, use `fal-ai/flux-kontext` image edit instead and say so.
- If a step is blocked, finish every other step and report exactly what is missing.

## Definition of done

A reviewer can start the app, click the vending machine, type something the story never planned for, and watch the depot change while Hermes walks across it. That is the whole proof.
