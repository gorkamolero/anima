# Brief 06 — steering, speed and complete walks

Status: implementation in progress; acceptance pending.

Read the complete goal, reviewer findings, Brief 05 report and git log -15. The reviewer supersedes the old footcheck verdict: physical foot locking is accepted; footcheck.py is retired as a gate. Pre-existing untracked AgentDebug.test.ts is preserved.

## Baseline
F9: alley side-far 87/111 off-floor frames; alley diagonal-toward-right 134/201; depot-outside post-behind 26/26.
F7: side median 1.14 m/s; diagonals 1.35–1.40; away 0.54; toward 0.59. Away cadence 1.45 steps/s. At maximum allowed cadence (2.2), away reaches only approximately 0.82 m/s against side minimum 0.912; playback alone cannot satisfy the supplied baseline. Toward maximum similarly predicts 0.84 m/s.
F8: road tree-front zero walking frames; far-exit 14 px; floor snapping collapses several far plans.

Full baseline output:
```
clip                                         walk s  dist px off-floor steps/s
alley/away-far.json                             1.8      75   10/42    1.14
alley/away-near.json                            3.2     114   29/78    1.23
alley/crate-behind.json                         2.7     328   12/64    1.50
alley/crate-front.json                          1.5     314   22/36    1.33
alley/diagonal-away-left.json                   1.4     339    0/33    1.45
alley/diagonal-away-right.json                  1.4     363    0/33    1.45
alley/diagonal-toward-left.json                 2.0     387   24/49    1.47
alley/diagonal-toward-right.json                8.4     456  134/201   1.55
alley/diagonal.json                             3.2     353   16/77    1.25
alley/exit.json                                 0.5     115    0/12    0.00
alley/object-click.json                         0.5      98    0/11    0.00
alley/side-far.json                             4.6     360   87/111   1.51
alley/side-near.json                            1.6     428    0/39    1.23
alley/toward-far.json                           1.7     127   28/40    1.20
alley/toward-near.json                          3.7     103    0/89    1.35
depot-inside/away-far.json                      1.2      37   12/28    0.86
depot-inside/away-near.json                     2.5      90    0/59    1.22
depot-inside/bench-behind.json                  1.1      54    0/27    0.89
depot-inside/bench-front.json                   2.7      71    0/64    1.50
depot-inside/diagonal-away-left.json            3.1     472    0/75    1.60
depot-inside/diagonal-away-right.json           4.9     482   25/117   1.64
depot-inside/diagonal-toward-left.json          7.0     439    0/167   1.58
depot-inside/diagonal-toward-right.json         8.5     346    0/203   1.54
depot-inside/diagonal.json                      3.9     361    0/93    1.55
depot-inside/exit.json                          1.2     271    0/29    0.83
depot-inside/object-click.json                  1.1      69    0/27    0.89
depot-inside/side-far.json                      2.5     416    0/59    1.22
depot-inside/side-near.json                     4.4     544   40/106   1.58
depot-inside/toward-far.json                    4.0      66   15/96    1.50
depot-inside/toward-near.json                   2.4      47    0/58    1.24
depot-outside/away-far.json                     1.8      66    0/44    1.09
depot-outside/away-near.json                    4.2     114    0/102   1.41
depot-outside/diagonal-away-left.json           4.0     413   13/95    1.52
depot-outside/diagonal-away-right.json          2.0     434    0/47    1.53
depot-outside/diagonal-toward-left.json         8.5     451   18/204   1.53
depot-outside/diagonal-toward-right.json        8.1     322   36/195   1.60
depot-outside/diagonal.json                     3.2     375   43/76    1.58
depot-outside/exit.json                         1.2      48   28/28    0.86
depot-outside/object-click.json                 0.4      99    0/9     0.00
depot-outside/post-behind.json                  1.1      48   26/26    0.92
depot-outside/post-front.json                   3.7      67    0/89    1.35
depot-outside/side-far.json                     2.2     391   12/54    1.33
depot-outside/side-near.json                    2.0     467   24/49    1.47
depot-outside/toward-far.json                   3.0      87   30/73    1.32
depot-outside/toward-near.json                  3.0     107    0/73    1.32
road/away-far.json                              5.2      71    0/125   1.34
road/away-near.json                             5.2      86    0/125   1.34
road/diagonal-away-left.json                    5.4     252    0/130   1.48
road/diagonal-away-right.json                   6.3     242    0/151   1.59
road/diagonal-toward-left.json                  8.5     250    0/204   1.53
road/diagonal-toward-right.json                10.3     270    0/248   1.55
road/diagonal.json                              5.3     268    0/127   1.51
road/exit.json                                  3.9     250   14/94    1.53
road/far-exit.json                              1.2      14    0/30    0.80
road/object-click.json                          1.2     207    0/29    0.83
road/side-far.json                              2.5     241    0/59    1.22
road/side-near.json                             2.0     341    0/47    1.02
road/toward-far.json                            7.6      63    0/182   1.45
road/toward-near.json                           5.0      64    0/120   1.40
road/trap-behind.json                           4.4     136   15/105   1.37
road/trap-front.json                            3.0     209   17/73    1.32
road/tree-behind.json                           5.1     324   33/122   1.38
road/tree-front.json                            0.0       0    0/1     0.00

side                 ground m/s min/median/max 1.01 1.14 1.96 (n=21)
walk-away            ground m/s min/median/max 0.28 0.54 1.12 (n=25)
walk-away-right      ground m/s min/median/max 1.04 1.35 1.91 (n=20)
walk-toward          ground m/s min/median/max 0.42 0.59 1.05 (n=20)
walk-toward-right    ground m/s min/median/max 1.04 1.4 2.18 (n=32)
```

## Implementation and commits
Motor now replans from the actual pose at each handoff, predicts all stance frames and the incoming sole, and rejects body/boot floor violations. Continuous correction is zero (inside the one-pixel allowance). Exit entry detection now distinguishes walking out of an exit region from entering it. Focused motor tests: 7 pass. Full proof pending.

## Verification and open failures
Final acceptance pending. Generation totals: 2 Kling, 1 BRIA, 0 image edits, no Veo. See calls.md.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

Generation progress: two Kling videos and one toward BRIA completed. Away BRIA upload blocked before submission by fal.ai exhausted balance. User informed; remaining independent work continues.

## Progress: assets and proof preparation
- Commits: 6eec882 (ledger), 9845320 (baseline evidence), c511b01 (closed-loop stance safety and entry-sensitive exits).
- New away/toward Kling cycles extracted with one constant normalization. Toward uses BRIA; away uses local gray keying after the account-balance refusal. Both contact sheets inspected frame by frame. Away source has coarse pose increments; expanded registration search handles these without moving the physical contact between frames.
- Startup now permits a safe partial stance and evaluates its stride vector independently of the idle-to-walk pose offset.
- Full test suite: 356 passed. Capture running in four independent muted browsers.
- Simulation before rendering (not a video acceptance substitute): 0 off-floor walking frames; medians side 1.61, away 1.80, away diagonal 1.55, toward 1.89, toward diagonal 1.60 m/s. Depth ranges remain materially wider than the medians.
- Every simulation plan walks at least one second. Some naturally blocked boundary approaches remain short of the path endpoint and require proof review.

## Boundary and integration follow-up
- a35fffe fixes placement restoring the previous pose; a1b15e3 adds the new depth sheets and playback rates.
- A first real render found two zero-frame road beats: their clicks were below the caption boundary and were rejected before navigation. Their requested clicks are now in the playable viewport. The actual foreground-tree crossing remains unsupported by the floor geometry; proof must distinguish nearest reachable walking from a real foreground crossing.
- Closed-loop routing now checks a second stance before taking a temporary sideways step and can pivot into a safe partial stance on a heading change. This resolves several boundary dead ends without moving the planted anchor.
- Half-stride arrival now considers the stride aimed at the remaining target at a turn, rather than only the incoming cycle.
- Concurrent uncommitted API derivation work invalidated the cached road during the town replay; the failed record created by this replay was recovered from the already-loaded scene. The API proof now uses committed API source in an isolated temporary runtime and a copied database. No unrelated source edits were reverted. The replay ledger path is explicit.
- Completed pre-fix render: 0 off-floor frames throughout; two rejected caption clicks produced no walking. Its outputs were retained in verification-06/walkstats-first-render.txt. Full final capture is being refreshed after the fixes.

## Latest verification progress
- dea7c81: validate the incoming handoff before drawing an old-cycle pose that would leave the body mask; ten focused motor tests pass.
- 1639a1f: an object with no reachable floor in front now falls back to the nearest reachable floor. This fixes a second cause of the empty tree-front beat: the click hit the fishing net and its approach routine returned without walking.
- f652d05: final generation ledger (2 Kling, 1 BRIA, 0 edits). Concurrent `CALL 04a` entries belong to separate floor work and were preserved without staging them.
- Latest full suite: 358 tests in 31 files passed. Engine/game/API typechecks and lint pass. Three root-motion registration tests pass. verify:art anchors pass with existing art-consistency warnings.
- `playtest-town.mjs --run=10 --ledger=tmp/walkqa/api-proof-env/api/data/calls.jsonl`: **FAIL**, `parent timed out`, with all recorded API calls cached. Road/alley cardinal walks and narrative edits completed; return from the edited alley stopped near (374,905), with target (352,942). Evidence: verification-06/town-stop-latest.json and town-switch-clearance.log. This is an open integration failure, not a passed journey.
- A fresh capture of all four scenes is running at code 1639a1f. Do not treat earlier partial JSON files as proof clips. The final audit will run only after all renderers finish.
