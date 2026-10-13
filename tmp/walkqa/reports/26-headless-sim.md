# Brief 26 — headless simulation

Status: simulator/compositor delivered and browser equivalence proven. **Footfall acceptance FAILS**: arrival and town regression remain unrepaired after two offline attempts. No full visual sign-off.

Baseline: `b3df1da`, branch `open-world-mvp`. Reviewed the goal, briefs 24/25,
findings, last eight commits and stopped changes. Pre-existing `calls.md`,
`tools/walkstats.py` and `AgentDebug.test.ts` are not part of this change.
Reviewer tools remain untouched. No asset edits or generation. Simulator makes no network calls. Browser audit found three uncached narration-options calls; see final ledger audit.

## Review of stopped work

The bounded best-stop search passes its 25 planner tests. The proposed entry
lattice densification failed four motor tests: it allowed supports/entry phases
incompatible with the drawn reverse settle. Restoring the standing sheet's
physical support and matched entry phase makes all 28 motor tests pass. Retain
the bounded search and first/last stance tolerance; do not claim the rejected
entry expansion was safe.

## Equivalence prerequisites

The worker and synchronous motor currently have different search settings.
Wall-clock deadlines change selected routes across machines; worker startup
adds a nondeterministic count of idle frames to browser captures. Runtime timing
must be measured outside deterministic frame telemetry, and captures must wait
at an explicit planning boundary. These are real divergences, not fields that
can be silently omitted from the comparison.

## Simulator progress

- First motor-only diagnostic: 139 walks in **1.371 s** (not equivalence evidence).
- Stored-record loader: read-only SQLite plus shipped/cached floor, occluder PNGs,
  interactables and exits. Alpha masks decoded locally with PIL. No HTTP or
  generation imports. Extracted footprint construction and exit approaches into
  production helpers used by the game and simulator.
- All ten rebuilt scenes match harness-24 **exactly** for walk area (all masks and
  perspective), classified objects and exit approaches. This checks data loading,
  not frame equivalence.
- Stored-record run: 139 walks in **7.021 s**, including PNG decoding/geometry.
- Search now has the same deterministic 4,000-expansion budget in worker and
  synchronous execution. Search `elapsedMs` is virtual planning time (0); wall
  planning time is recorded separately in `run.json`. No wall-time cutoff can
  select a different route. This budget is a work cap, not a proof of optimality.
- PIL compositor added for raw backgrounds, logged sprites, occluder order and
  Kat sprite crops. Pixel comparison results follow.

## Eight-walk equivalence proof

`tmp/walkqa/equivalence-26/diff-report.json`: **8/8 equal, zero differences**, all
fields included, no ignored telemetry keys, tolerance 1e-6 (observed maximum 0).
Scenes outside, inside, road, alley; near-left and near-right in each. Three
routes contain no walking because this planner cannot find a valid route; the
other five exercise source cycles and settles. This is not an eight-successful-
route claim. Browser harness is a derivative of harness24 with an explicit
planning barrier, retaining the same capture code and targets.

`tmp/walkqa/equivalence-26/pixel-report.json`: first/middle/final frames of all
eight walks, 24 comparisons. Full-image differences include the game text/UI,
which the compositor intentionally does not draw. Below y=172, mean absolute
channel error ranges **0.087–1.095 / 255**. PIL and GPU filtering are not pixel
identical. Cached frame composition takes **15–160 ms**; initial example sheet
663 ms. Inspected the browser/composite pair for exterior frame 60: positions,
poses, Kat and layer order agree visually. All eight real proof contact sheets inspected; the nonwalking routes remain visibly stationary.

## Arrival experiments

Attempt 1: fixed 4,000-node budget, 3 cm duplicate cells, stop weight 8. 139 walks
in **7.008 s**; maximum synchronous planning time 62.7 ms; 13 half-stride arrivals.

Attempt 2: duplicate cells densified to 5 mm, stop weight increased to 32;
first/last facing tolerance remains 35 degrees only. Added collision-validated
smooth final-support absorption: at most min(1.45 px, 5% of final-support body
travel), only when it covers the entire remaining error. Explicit user stop
requests do not absorb. Added a synthetic playback test proving a 1 px correction
is gradual and bounded. 139 walks in **7.135 s**, still 13 half-stride arrivals;
zero corpus walks had error small enough for permitted absorption. This is a
failed arrival repair, not successful arbitrary-point reachability.

The best initial residual is 1.775 px; many residuals are hundreds of pixels.
A 1.5 px stance excursion budget cannot absorb those errors. Increasing the slide
allowance to hide them would violate the stated goal. No such increase was made.

## Two-attempt gate results and retained limitations

| Motor diagnostic | Walks | Floor | Scale | Lock <=1.5 px | Depth | Facing | Path | Half-stride arrivals |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Attempt 1 | 139 | 139 | 139 | 139 | 139 | 81 | 68 | 13 |
| Attempt 2 | 139 | 139 | 139 | 139 | 139 | 86 | 61 | 13 |

All ten scenes were retained in both attempts. Per-walk results are in each
`sim/26-attempt*-records/checks.json`; do not interpret motor-only behavior counts
as scene behavior verification. These attempts establish named **implementation
failures**, not mathematical impossibility of walking these rooms:

- **L26-route:** native stance actions cannot approach many targets under facing,
  turn and floor constraints. The bounded search returns a stop, but some stops
  are hundreds of pixels short. Both cost/duplicate-cell attempts fail. Densifying
  reverse-settle entry phases was also rejected by four physical-support tests.
- **L26-facing/path:** the finer lattice raises facing from 81 to 86 but reduces
  path passes from 68 to 61. The goal's path bar is still 1.05x octilinear optimum.
- **L26-absorption:** final stance can absorb at most its actual drift budget.
  A synthetic 1 px error is corrected smoothly; no corpus residual fits the
  budget. Arbitrary-point arrival is not achieved by this change.

## Full scene runtime

The simulator now computes click routes itself with shared object-approach logic,
uses the production exit guard and return-arrival placement, and reads narration
options by the production cache key from read-only SQLite. Both connected exits
that trigger in the corpus are played through their destination arrival walks.
No missing cache entries in the 139-walk run. Runtime **7.438 s**. Capture now has
an I/O barrier between frames as well as a planner barrier: waiting for local
records/network responses is not counted as animation time. Final comparison
must still establish that these scene phases match the browser.

Intermediate suite: 472 tests passed; typecheck and lint passed. An early ledger snapshot had 59 cached calls. The final audit below supersedes it. Pre-existing dirty files were not edited by this work (the API continues to append its calls ledger).

## Final sign-off results

Frozen production commits: `9fee522` (motor), `677d0cc` (shared scene behavior),
`362a44b` (simulator/compositor). Final headless run: **139 walks, 8.153 s**, maximum
per-walk synchronous planning 86.9 ms (includes multiple plans on exit arrival).
The 139 simulator click destinations exactly match the original harness inputs.
All compositor six-fps sheets, stops, five reproducible random plus flagged feet
crops, crossing/turn triples generated under `sim/26-final`.

`verify:art --generated`: all scenes PASS. Full suite: **472 tests PASS**.
Typecheck and lint PASS.

Town replay 126: **FAIL**, depot-left residual **158.486 px** versus half-stride
**71.555 px**. Exact distance 158.486, absorbed distance 0. Ledger: 10 cached calls,
**0 uncached**. This requested regression is not repaired and acceptance is not met.

Final browser evidence is under `harness-26`; all 139 completed logs match exactly.

## Final capture findings

Two adapter issues were caught by strict comparison, and repaired without changing
motor behavior. The stepped-street `exit-far` target is an object hit (the old exit
no longer exists): the simulator now uses the same extracted alpha/bounds/floor
hit test as the scene. Only its object field changed. The road-to-alley exit needs
camera fade clock updates while asynchronous scene loading is paused. The harness
now admits fade-out frames but waits for I/O during fade-in; the simulator imports
Phaser's actual DOM-free Fade class. That transition is exactly equal including
seven hidden frames. It is not an instantaneous scene substitution anymore.

Final corrected headless run: **139 in 10.316 s**, with browser capture/checkers
running concurrently. Latest validation: **475 tests in 51 files**, typecheck and
lint PASS. Full browser equivalence and final video totals are recorded below.

Capture execution: disjoint scene partitions shared one final evidence directory.
An interrupted outside/exit-far snapshot and a road fade/I/O deadlock were retried;
one road capture with a too-broad fade barrier was superseded. There was no second
full 139-walk browser iteration. The final game-only change during this stage is
an extraction of the unchanged object hit-test body into the shared helper.

## Final evidence and bars

- `harness-26/diff-report.json`: **139/139 equal**, every field and frame count,
  zero differences, observed max numeric error 0; tolerance 1e-6. No exclusions.
- Final standalone repeat: **139 in 7.880 s**, byte-value-equivalent parsed frame
  logs to the confirmed run (`sim/26-final/repeatability.json`). The prior corrected
  concurrent run was 10.316 s; both include record loading and mask decoding.
- `sim/26-final/results.json` and each scene's `results.json`: all per-walk checks,
  exact/pre-absorption distance, absorbed distance and known failure status.
- **0 exact arrivals, 12 half-stride arrivals, 0 absorbed corpus walks.** These
  are final motor arrival records, including destination arrival on travel. The
  initial source-route diagnostics counted 13; those are not the same measure.
  No exact result was manufactured by changing the tolerance. The bounded 1 px
  absorption unit test passes, but it has not solved the corpus.
- **475 tests / 51 files PASS**, typecheck PASS, lint PASS, `verify:art --generated`
  all scenes PASS. Town journey remains FAIL at depot-left, as recorded above.

Counts below are passes / scene walk count, not a scene-level pass. Every scene
fails the complete goal. Stance drift uses 1.5 px, slide median 5% / p90 15%; path
uses the goal's 1.05 octilinear bar. Turns counts heading changes between adjacent
walking samples against visible body travel at the goal's 1 per 300 px. Facing is
reported with the requested reviewer `facing_stance.py`; its stance-based measure
is not silently relabeled as a literal per-frame facing percentage.

| Scene | Walks | Lock | Slide | Floor | Scale log | Facing | Turns | Path | Behavior | Depth | Pixel height | Freeze |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alley | 14 | 14 | 13 | 14 | 14 | 10 | 14 | 5 | 0 | 14 | 13 | 14 |
| church | 12 | 12 | 11 | 12 | 12 | 10 | 12 | 1 | 0 | 12 | 12 | 12 |
| grocery | 12 | 12 | 12 | 12 | 12 | 9 | 12 | 5 | 1 | 12 | 6 | 12 |
| inside | 13 | 13 | 10 | 12 | 13 | 9 | 13 | 9 | 2 | 13 | 11 | 13 |
| lobby | 12 | 12 | 8 | 12 | 12 | 6 | 10 | 7 | 0 | 12 | 10 | 12 |
| outside | 17 | 17 | 14 | 17 | 17 | 11 | 14 | 8 | 3 | 17 | 8 | 17 |
| pier | 14 | 13 | 10 | 14 | 14 | 9 | 11 | 8 | 0 | 14 | 5 | 14 |
| road | 17 | 17 | 15 | 17 | 17 | 8 | 13 | 4 | 3 | 17 | 4 | 17 |
| square | 13 | 13 | 9 | 13 | 13 | 7 | 12 | 5 | 0 | 13 | 6 | 13 |
| stepped-street | 15 | 15 | 11 | 15 | 15 | 7 | 13 | 9 | 2 | 15 | 13 | 15 |
| **Total** | **139** | **138** | **113** | **138** | **139** | **86** | **124** | **61** | **11** | **139** | **88** | **139** |

Only inside/occluder-back and road/deepest pass the combined numeric checks.
No numeric pass is a visual acceptance. Pixel-height failures include 41 clips
with insufficient measurable unoccluded coverage, eight with measured height
errors, and two scene-transition clips unsupported by the single-background
pixel checker. Those are unverified/failing measurements, not 51 proven scale
bugs. All 139 clips have zero identical rendered frames while walking according
to the unchanged `freeze.py`.

Additional retained failures: **L26-object-turn**, pier/object stance excursion
59.63 px; **L26-return-floor**, inside/exit-bus_platform frames 60–71 off floor
at the exterior threshold. These surfaced only with full scene behavior, so the
earlier all-pass motor-only floor/lock figures must not be used for sign-off.

## Visual review extent

Generated six-fps contact sheets, stop sequences, all identified crossing/turn
triples, and flagged plus five seeded random feet crops for all 139. Reviewed the
10 scene feet boards, all eight equivalence contact sheets, exterior and road
final contact sequences, and real video-decoded stop/crossing sequences for one
walk in each scene (`harness-26/real-review/*.jpg`). This is a sampled review with
concrete failures, **not every-frame visual sign-off**; `visual-index.json` keeps
`reviewed: false` for full per-walk sign-off. Remaining exhaustive review is not
represented as complete.

Concrete examples: inside/exit-bus_platform #60–71 stands on the threshold outside
the floor mask; grocery/object #51–59 holds an awkward raised-heel stance after
the object turn; pier/near-right #24–36 appears oversized against the planks;
stepped-street/exit-far #34–40 stops facing the houses instead of leaving through
the absent far exit. Outside/diagonal-away #166–180 becomes hidden behind the
truck; depth order matches the logged baseline, but this does not establish good
arrival. These are retained scene limitations, not reasons to drop their walks.

Compositor caveats: UI and camera fade overlays are not rendered; it is an actor/
layer inspection aid. PIL filtering differs from WebGL. The 24 pixel comparisons
cover the eight proof walks, not transition fades. Raw scene/art files were never
edited. Composing one frame is milliseconds; constructing and saving all 139
review sets took about 95 seconds, not milliseconds for the entire corpus.

## Ledger and cleanup

Simulator: read-only stored records, no HTTP or paid calls. Town replay 126:
10 cached / **0 uncached**, but journey FAIL. Final browser/server ledger audit
since QA server startup: **936 calls, 933 cached, 3 uncached narration-options**
(at 15:51:40 UTC). The reused server wrapper labeled these `brief: 25`; the audit
is time bounded and saved as `sim/26-final/call-audit.json`. This corrects the
early no-paid-call statement. No image/video generation or segmentation calls.

QA API 4317 and game 8080 stopped; task-owned browser sessions closed. Owner
4410/8090 untouched. Removed intermediate simulation staging directories after
exact repeatability comparison; retained final evidence and both failed attempts.
No push, merge, deploy, key writes or dotenv edits. Reviewer tools were not edited.

## Reproduce the fast loop

From repository root, with the existing local tsx and PIL environment:

```sh
api/node_modules/.bin/tsx adventures/shadow-over-innsmouth/scripts/simulate-walks.mts --run=next
WALKQA_ROOT=tmp/walkqa/sim/next tmp/walkqa/tools/venv/bin/python tmp/walkqa/check26.py tmp/walkqa/sim/next
tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/composite.py tmp/walkqa/sim/next/outside/near-left.json 60 --out tmp/walkqa/sim/next/frame60.png
```

`--scenes=outside,inside` and `--walks=near-left,near-right` narrow a simulator
run. The simulator reads the harness-24 plans, never its frame logs. The separate
numeric reviewer suite is much slower than simulation (not part of the <60 s
simulation benchmark); scope iteration checks to changed walks when appropriate.
Production source hashes are in `sim/26-final/source-sha256.json`.

Source audit: all captured motor/planner/asset hashes match the final files.
124 scene captures predate the object-hit extraction; 15 include it. The sole
scene-source difference is moving the same hit-test body behind `objectAtPoint`
(and its import). This is recorded rather than claiming every capture has an
identical scene-file hash. No motion implementation changed during final capture.
