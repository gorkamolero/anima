# Brief 26 — headless simulation

Status: in progress; no equivalence or acceptance claim yet.

Baseline: `b3df1da`, branch `open-world-mvp`. Reviewed the goal, briefs 24/25,
findings, last eight commits and stopped changes. Pre-existing `calls.md`,
`tools/walkstats.py` and `AgentDebug.test.ts` are not part of this change.
Reviewer tools remain untouched. No paid calls or asset edits.

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
  Kat sprite crops. Pixel comparison pending.

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
poses, Kat and layer order agree visually. Full eight-walk visual review pending.

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

Latest full suite: 472 tests pass. Typecheck and lint pass. Reviewer tools and
pre-existing dirty files unchanged. Browser QA ledger so far: 59 cached calls,
0 uncached. `verify:art`, town replay, final browser logs and visual review pending.
