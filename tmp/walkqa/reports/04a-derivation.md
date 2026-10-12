# Brief 04a — floor derivation

Partial result: all six cached scenes were re-created through POST /api/places on port 4700, with diagnostic occluders and exits. The final pipeline accepts the square and explicitly fails the other five. The square also has a visual coverage limitation. This is NOT a six-scene hard-floor pass or Footfall signoff.

## Changes

- Scene descriptions and detected labels select multiple positive floor/material prompts, whose masks are unioned. Negative masks remove walls, water, furniture, pews, counters and other scene obstacles. Every returned mask, union, exclusion, depth raster, fitted plane and final floor is retained under `tmp/walkqa/derivation/<place-id>/`.
- Independent SAM2 spatial fallback supplements sparse semantic masks. Live SAM2 requests succeeded after correcting its point-label schema to numeric 1 (the official API example uses a number despite the SDK enum). Earlier provider balance failures were transient; they are not the final blocker.
- Robust depth-plane residuals reject inconsistent pixels. Depth fills enclosed small gaps within the floor envelope; it cannot expand freely into similarly deep water or walls. Actual segmented stairs bypass the single-plane constraint. A conservative edge margin avoids furniture contact.
- Floor-supported walking lines cannot interpolate across obstacles or disconnected islands. The six-point wire format is preserved. Intricate paths use a conservative horizontal legacy lane; the full 2D floor mask remains authoritative.
- No new-place anchor inheritance remains. This is stricter than the permitted same-view/80% overlap exception and prevents unrelated church/lobby views from inheriting the depot line.
- Derivation failures persist as places with `ground: "failed"`, a reason, empty active floor/line/regions, `walkable:false`, `travelEnabled:false`, and diagnostic overlays. POST returns the saved place. Normal lists omit failures; GET by ID returns 409 with diagnostics; `?includeFailed=true` includes them. POST `refresh:true` retries using the cached image.
- Whole-floor reviews and sprite-placement reviews preserve each question, answer, reason, pass, attempt and exact overlay. Both rejected attempts survive. A second whole-mask review checks the first review's cited evidence against intentional clearance margins; an unresolved rejection still blocks walking. Identical whole-mask pixels/questions reuse a content-addressed verdict.
- Occluders reuse semantic obstacle masks, include pews/pillars/fountains/desks/shelves, and require floor contact unless clipped at the foreground boundary. Exits no longer invent side openings; interiors do not fabricate a far exit at the end of a closed aisle.

## Optional regions contract

`ground.regions` is an optional array in 1920×1080 game coordinates:

```ts
{
  id: string,
  kind: "floor" | "stairs",
  polygon: { x: number, y: number }[], // rectangular index bounds only
  mask: { width: number, height: number, data: number[] }, // full-scene raster
  scaleAtY: { y: number, scaleFactor: number }[],
  interpolation: "linear",
  source: "relative-depth"
}
```

Membership requires polygon containment AND a 1 in the corresponding full-scene raster cell. Regions are disjoint and their union equals the derived floor. Stair membership comes from segmented stair pixels, not a vision polygon. Each local x/y region independently samples median relative inverse depth. Interpolate the y table, clamp to its endpoints, and multiply by `ground.baseScale`. A single sample is constant. Factors are bounded to 0.18–1.5; these are relative estimates, not metric calibration. Global perspective remains the compatibility fallback. Failed places expose no active regions; candidate regions are diagnostics only. The motor integration belongs to the other agent.

## Proof interpretation

Green = allowed floor; yellow = horizon; pink = six-point walking line; cyan = region index bounds (not membership); orange = occluder baselines; blue = exits. Named `tmp/walkqa/derivation/<key>-overlay.png` files show rejected candidates where status is failed, so the defect can be inspected. Their active failed floor is empty. The exact grayscale/green mask images seen by judges and every verdict are archived under each place ID.

## Final corpus and visual inspection

I inspected all six final overlays, including the rejected church and lobby overlays. The manifest is `tmp/walkqa/corpus-places.json`; full responses, geometry counts, candidates and exact judged overlays remain in `tmp/walkqa/derivation/`.

| Scene | Final API ground | Occluders / exits | Candidate regions / stairs | What I saw |
|---|---|---|---|---|
| Pier | failed | 8 / 2 | 5 / 0 | Main boards are covered around crates, posts, nets and visible water gaps. The porch and some narrow board strips are omitted. The judge rejects incomplete boardwalk coverage; some cited black holes visibly contain water, so its explanation is not entirely reliable. No acceptance override. |
| Stepped street | failed | 3 / 3 | 8 / 4 | Steps extend into the fog and the lamp base is excluded. Net/buoy boundaries and the lower-left ground/water-like strip remain uncertain. Judge rejects net/buoy/post inclusion. |
| Church | failed | 11 / 2 | 3 / 0 | Central aisle is covered, pew bodies and pulpit excluded, with individual pew baselines. Small green fragments near/under pew edges remain; the raised rear floor around the pulpit is omitted. Side passages are not established reliably. |
| Lobby | failed | 5 / 2 | 6 / 2 | Rug and foreground floor are now included; desk and pillars are excluded. Only lower stair patches survive, and upper exposed treads remain unmasked. This is a genuine staircase coverage failure. |
| Grocery | failed | 8 / 2 | 5 / 0 | Foreground, central aisle and right-side passage are covered; counter, shelves and large sacks are excluded. Rear narrow aisle coverage is incomplete/uncertain. Judge additionally cites bottom-right barrels; that claim is less clear by eye, but its unresolved rejection is retained. The former false far exit at the closed rear shelf is gone. |
| Square | derived | 4 / 1 | 6 / 0 | Cobbled foreground wraps around the fountain's front and sides, excluding its body/plinth, lamp bases, buildings and sea. The rear wooden deck is missing. The judge accepts the cobbled mask, but I do not sign off full visible-floor coverage or a complete route behind the fountain. |

The table's region counts are diagnostic candidates. Failed places have ZERO active regions; the stepped street/lobby regional scale format exists but is not cleared for walking. Counts in the JSON manifest are authoritative if a table count differs.

## Iterations and remaining limitations

More than two corrective approaches were tried on the failing scenes: multiple material prompts and union; spatial SAM2 fallback with positive seeds; robust depth filtering and enclosed-gap fill; object-specific exclusions (including pulpit, pews, nets, barrels and posts); and boundary clearance. Rug masking fixed the lobby's missing rug. Pulpit exclusion fixed church furniture inclusion. Steps/stairs masks supplied local depth regions instead of forcing a single plane. Repeated refinements still did not establish complete, clean passage coverage in all six images.

Whole-mask judge results varied on unchanged pixels during earlier runs. The last implementation caches identical question/pixel reviews, preserves every historical verdict, and retains the final failures rather than selecting earlier favorable results. A vision verdict alone does not prove complete coverage; the square's missing rear deck is a concrete example. Remaining work is better semantic coverage/obstacle boundaries and more reliable independent review, not anchor-line fallback. No source image was replaced to make the corpus easier.

## Verification and budget

- `pnpm --filter @anima/api test`: 71 tests across 13 files passed.
- `pnpm --filter @anima/api typecheck`: passed.
- `pnpm --filter @anima/api lint`: passed, 36 files checked.
- Live API checks: all six POSTs returned 200 with a saved place; square lookup returned 200; five failed lookups returned 409; normal place listing excluded all failures. Failed masks/lines/regions were empty. The derived six-point line was sampled along every segment and stayed within its mask.
- Final geometry replay exercised template-aware occluder/exit derivation for all six cached candidates; no new segmentation calls. Six final named overlay PNGs were opened and inspected.
- 86/120 segmentation/depth attempts, including failed submissions; 0/2 image edits; 0 videos. `tmp/walkqa/calls.md` contains the numbered `CALL 04a` ledger. Entries from other concurrent briefs are not this task's calls.
- Logs: `tmp/walkqa/logs/04a-tests.log`, `04a-typecheck.log`, `04a-lint.log`, `04a-api-final-proof.log`.
- No game-wide suite or walking proof was run. Engine, adventure source/scripts and sprite files were not edited or committed by this work. No push, merge, deployment or GitHub settings changes.
- Port 4700 server stopped; `lsof -nP -iTCP:4700 -sTCP:LISTEN` confirmed no listener. Ports 4317/8080 were not stopped.
