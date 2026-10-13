# Brief 30 — both bars

Gate unchanged; historical source ran in `tmp/bisect-30` with identical reviewer files and cached scene data. The gate's hardcoded `cd` was redirected by a shell function.

| Commit | Gate line |
|---|---|
| `39f40c8` | `run=30-bisect-39f40c8 half=103 one=10 far=15 facing=89 reversals=12 flicker=21 lock=0 offfloor=0 objcontacts=0` |
| `d263569` | `run=30-bisect-d263569 half=103 one=10 far=15 facing=89 reversals=12 flicker=21 lock=0 offfloor=0 objcontacts=0` |
| `748dc7f` | `run=30-bisect-748dc7f half=47 one=20 far=65 facing=111 reversals=0 flicker=3 lock=0 offfloor=0 objcontacts=0` |
| `68edbe0` | `run=30-bisect-68edbe0 half=43 one=23 far=66 facing=120 reversals=0 flicker=3 lock=0 offfloor=0 objcontacts=0` |
| `382934c` | `run=30-bisect-382934c half=43 one=23 far=66 facing=120 reversals=0 flicker=3 lock=0 offfloor=0 objcontacts=0` |

Arrival loss: `748dc7f` costs 56 arrivals (103 → 47); strict facing `68edbe0` costs 4 more (47 → 43). `d263569` and `382934c` are neutral on this corpus. Historical commits fail current floors as expected.

| Retained change | Gate line |
|---|---|
| `3462a3e` | `run=30-entry-phases half=49 one=19 far=63 facing=121 reversals=0 flicker=3 lock=0 offfloor=0 objcontacts=0` |
| `2efb04a` | `run=30-stop-phases half=49 one=19 far=63 facing=123 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `46a13d6` | `run=30-history-final half=60 one=24 far=46 facing=123 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `416006a` | `run=30-shared-restarts-final half=70 one=19 far=41 facing=124 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `8bba9ab` | `run=30-validated-final half=77 one=18 far=33 facing=129 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `83c2ccb` | `run=30-guided-search half=79 one=18 far=31 facing=129 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `2b11bb3` | `run=30-arrival-priority half=80 one=17 far=30 facing=129 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `fd8c41d` | `run=30-edge-run-freedom half=97 one=8 far=21 facing=129 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `32bb1ca` | `run=30-exit-phases half=100 one=7 far=19 facing=130 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `f1b0364` | `run=30-cached-stances half=100 one=7 far=19 facing=130 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `ad7f5b9` | `run=30-complete-first half=101 one=6 far=19 facing=130 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `6c90140` | `run=30-authored-radius half=101 one=6 far=19 facing=130 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `b52ea8b` | `run=30-accuracy-refinement half=101 one=6 far=19 facing=131 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `fd14604` | `run=30-final half=104 one=4 far=18 facing=131 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `10bc2ab` | `run=30-pivot-pruning half=104 one=4 far=18 facing=131 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `515503c` | `run=30-town-allowance half=104 one=4 far=18 facing=131 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `3da9ac0` | `run=30-motion-lifecycle half=104 one=4 far=18 facing=131 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |
| `f4ad756` | `run=30-passage-room half=104 one=4 far=18 facing=132 reversals=0 flicker=1 lock=0 offfloor=0 objcontacts=0` |

| Final check | Result / evidence |
|---|---|
| Gate | **PASS: half 104, facing 132, reversals 0, flicker 1, lock 0 px, off-floor 0, object contacts 0.** Floors: 104 / 132 / 0 / 1. 139 walks; 126 arrival measurements and 13 scene transfers. Simulator: 163.7 s. |
| Browser equivalence | [8/8 exact; 0 differences; maximum numeric difference 0](../sim/30-passage-room/browser/diff-report.json). Outside, inside, road, alley × near-left/right; clips and contact sheets alongside telemetry. |
| Tests | [506/506, 53 files](../sim/30-passage-room/validation/tests.log), `pnpm test:run --maxWorkers=1`. Earlier concurrent runs hit timing limits; this serial run passes unchanged assertions. |
| Typecheck / lint | [Typecheck PASS](../sim/30-passage-room/validation/typecheck.log); [lint PASS](../sim/30-passage-room/validation/lint.log). |
| Art | [`verify:art --generated`: all scenes PASS](../sim/30-passage-room/validation/art.log). |
| Town replay | [Run 143 PASS](../sim/30-passage-room/validation/town/run-143.json): 25 checkpoints, 23 cached calls, **0 uncached calls**. Fixed depot detour allowance, pending-worker idle notification, and distant-passage walk-in. |
| Paid calls | [Entire final-check session: 324 cached, 0 uncached](../sim/30-passage-room/validation/ledger-audit.json); provider network blocked. |
| Remaining limits | [22 named arrival limitations with frame windows and annotated simulator frames](../sim/30-passage-room/validation/limitations.json): 4 between half and one stride, 18 farther. These are bounded-search limitations, not claims of geometric impossibility. [7 facing failures remain](../sim/30-passage-room/validation/facing.jsonl). Full FOOTFALL-GOAL sign-off remains open. |
| Cleanup | [QA ports 4317/8080 closed; bisect worktree removed](../sim/30-passage-room/validation/cleanup.json). Owner ports 4410/8090 preserved; no push. Automatic approval review blocked deletion of the temporary `brief-30-worktree-reviewer-copy` stash because it permanently discards stashed changes; retained. |
