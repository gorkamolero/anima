"""Build the final report from retained, independently checked evidence."""
from pathlib import Path
import json,subprocess
r=Path('tmp/walkqa');v=r/'verification-06';p=r/'reports/06-steering-speed.md'
progress=v/'implementation-progress.md'
if not progress.exists():progress.write_text(p.read_text())
locks=[json.loads(s) for s in (v/'lockcheck-final.jsonl').read_text().splitlines()]
targets=json.loads((v/'targets.json').read_text());by={x['clip']:x for x in targets}
body=json.loads((v/'body-floor.json').read_text());manifest=json.loads((v/'proof-manifest.json').read_text())
town=json.loads((v/'town-final.json').read_text());stats=(v/'walkstats-final.txt').read_text();speeds={}
for line in stats.splitlines():
 if 'ground m/s min/median/max' in line:
  name,values=line.split('ground m/s min/median/max');speeds[name.strip()]=list(map(float,values.split()[:3]))
s='''# Brief 06 — closed-loop steering, speed and real walks

**Status: NOT ACCEPTED against the complete brief/Footfall goal.** The explicit locking, raw-floor, aggregate median-speed, cadence and walking-duration checks pass across all 63 clips. The stronger speed-at-every-depth requirement still fails; tree-front has two identical walking frames; the alley far exit reaches its approach but its provider-disabled narration request fails. A real foreground-tree crossing remains unsupported by the current floor geometry.

The complete goal, reviewer findings, Brief 05 report and `git log -15` were read before implementation. The retired `footcheck.py` was never used as a gate. This report records both the successful checks and the remaining failures; it is not a sign-off on the broader ten-scene Footfall goal.

## Delivered behavior

At each support switch, the motor replans from the actual body/contact position, evaluates all eight headings through the current perspective, and predicts the complete stance plus incoming foot landing. Boots use the raw floor mask; the body uses the eroded mask. Unsafe candidates are rejected. Bounded continuation search handles routes requiring an intermediate sideways step; it selects only the next stance and replans again at the next switch. If no safe continuation exists, the motor stops on its current foot. Continuous anchor correction is **zero**, within the permitted one-pixel allowance. Arrival uses half the projected stride toward the remaining target.

New away/toward Kling cycles have longer strides. FPS: side 33, away 25, toward 25.5, away diagonal 25, toward diagonal 26.5. Unequal source support lengths receive equal support durations at the nominal cycle cadence. Matching-foot partial entries allow boundary turns; one-frame entries are prohibited after a rendered regression exposed a hidden double handoff. Short partial entries can still hold a pose too long, as recorded below.

Object clicks with no floor in front now approach the nearest reachable floor. Explicit exit clicks take priority over object pixels. Exit approach points provide final-stance clearance while physical gate regions remain separate; half-stride arrival can fire only the requested gate at its configured approach. Walking away from a gate no longer retriggers it.

## Final measurements

'''
s+=f'- **{len(manifest)} clips**, 1920×1080, exactly 24 fps; every decoded frame count equals its JSON row count. Files: `tmp/walkqa/final-06/`. Raw masks: each `area.json`; eroded/body geometry: each `navigation.json`.\n'
s+=f'- **Lockcheck: max {max(x["maxExcursion_px"] or 0 for x in locks):.2f} px**, all {len(locks)} clips. **0 off-floor planted-contact frames** and **{sum(len(x["offBodyFrames"]) for x in body)} off-floor body walking frames**.\n'
s+='- All measured per-clip cadences are 1.6–2.2 steps/s. Every clip walks at least one second; shortest is '+f'{min(x["walkingFrames"] for x in targets)/24:.3f}s. No arrival-only exemptions were used.\n'
s+='- Every non-exit approach has a recorded half-stride arrival; physical exit crossings may transition before such an arrival. Five source-to-destination transitions are preserved in `tmp/walkqa/transitions-06/`. Their source-scene prefixes are tested against the source mask, with no source walking frames discarded. Alley far exit remains incomplete.\n'
s+=f'- Engineering: **375 tests / 35 files pass**; engine, game and API typecheck and lint pass; three contact-registration Python tests pass; anchor `verify:art` passes with the existing art warnings.\n- Town run **{town["run"]}: PASS**, full journey through `inside`, `inside-option`, and `finish`; **{len(town["calls"])} cached calls, {sum(not x.get("cached",False) for x in town["calls"])} uncached calls**. This uses the isolated committed API/cache fixture described under provenance.\n'
s+='''
### F7 — before / after speeds

| Cycle | Brief 05 median m/s | Brief 06 median m/s | Ratio to side | Brief 06 min–max m/s |
|---|---:|---:|---:|---:|
'''
for name,before in [('side',1.14),('walk-away',.54),('walk-toward',.59),('walk-away-right',1.35),('walk-toward-right',1.40)]:
 a=speeds[name];s+=f'| {name} | {before:.2f} | {a[1]:.2f} | {a[1]/speeds["side"][1]:.3f} | {a[0]:.2f}–{a[2]:.2f} |\n'
s+='''
These aggregate medians all meet ±20% of side. They do **not** establish the same speed at every depth. The supplemental audit groups actual adjacent same-cycle walking samples into 40-pixel body-depth bins, requiring at least 24 pairs for both the cycle and side. On road at y=760–800, toward averages **3.073 m/s versus side 1.924 (1.597×)**; at y=800–840 it averages **2.889 versus 1.648 (1.753×)**. At y=840–880, away averages **0.873 versus 1.540 (0.567×)**. This diagnostic is a mean within a depth band, not the reviewer's per-clip median, and the walks differ in horizontal path and support phase. It exposes remaining depth dependence; no universal speed claim is made. Raw samples and frame references: `verification-06/depth-speed.json` and `.txt`.

The playback-only baseline estimate could not bring old away/toward cycles to the target within the cadence ceiling. The two permitted new videos and subsequent playback/support-duration tuning improved aggregate speed and cadence, but did not solve the depth dependence. No further paid video was generated.

### F9 — floor containment

Reviewer Brief 05 counts using its older mask export: alley/side-far **87/111**, alley/diagonal-toward-right **134/201**, depot-outside/post-behind **26/26**. Rechecking the old clips with their original sprite metadata against the raw mask gives **50/111**, **103/201**, **26/26** respectively, **254 off-floor frames total**. Brief 06 has **zero** in every clip. Both mask semantics are stated to avoid presenting an eroded/raw comparison as an identical baseline. Preserved baseline: `verification-06/baseline-raw-floor.json`, `baseline-sprite-metadata.json`, `walkstats-before.txt`.

### F8 — walks and destinations

'''
for name,before in [('road/tree-front','0 walking frames'),('road/far-exit','14 px displacement')]:
 a=by[name];s+=f'- `{name}`: before {before}; after **{a["walkingFrames"]} walking frames ({a["walkingFrames"]/24:.2f}s)**. '
 if a['requestedExit']:s+=f'Exit completed: **{a["exitCompleted"]}**. '
 if a['arrival']:s+=f'Arrival distance {a["arrival"]["distance"]:.2f}px / allowed half stride {a["arrival"]["halfStride"]:.2f}px. '
 s+='\n'
s+='''
The tree-front click hits the left fishing net and now walks to reachable floor through the object fallback. It is **not a foreground-tree crossing**: the current mask has no such route. The retained name records the original request instead of quietly replacing it. Depot floors are shallow; “far” labels alone do not prove a distinct distant depth after snapping. Road/tree-behind reaches a physical edge exit, and its complete transition is retained separately.

## Open failures with frames

1. **Depth-dependent speed (F7)** remains outside ±20% in the supplemental matched-depth samples above. Witnesses: `verification-06/failure-frames/road-toward-far-f0023.png`, `road-toward-far-f0056.png`, `road-trap-front-f0105.png`; corresponding full MP4/JSON logs remain under `final-06/road/`. A single still is a locator, not speed evidence; use the adjacent logged frames.
2. **Two frozen walking frames in road/tree-front**, indices **300 and 301** (zero based), out of 325 walking pairs. The motor holds away-diagonal source frame 13 around this partial support turn; this is a real motion limitation, not dismissed as a checker error. Frames 295, 299, 300, 301, 302 and 304 are retained in `verification-06/failure-frames/road-tree-front-f*.png`. All other 62 clips report zero identical walking frames. Earlier fixes addressed hidden one-frame pivots and uneven cadence; the remaining short-phase pose hold is unresolved.
3. **Alley far exit does not transition.** It walks 97 frames and reaches (579.26,645.73), 3.69px from approach (582.5,647.5), within the 35.97px half stride. `POST /api/narrate` returns **502** in the credential-disabled isolated runtime after the travel trigger. A fresh valid world session fixed the road far exit cache replay but still leaves this alley request without a usable cached response. Evidence: `final-06/alley/exit.mp4`, `.json`, `verification-06/capture-alley-fresh-exit.log`, `api-fresh-exits.log`, `failure-frames/alley-exit-f0096.png`. No fabricated cached response, destination substitution, or paid narrative retry was used.
4. **Foreground-tree crossing is unsupported by the current floor**, as described above. `road-tree-front-f0300.png` shows the actual nearest-floor approach. The broader goal's all-crossing visual sign-off, ten-scene coverage, facing/path bounds and automatic derivation are not claimed by this four-scene brief.

The failed 6.89px intermediate trap-front pivot remains in `verification-06/before-visible-pivot/`; the final clip passes after disallowing one-frame support entries. Historical town failures and iteration measurements remain in `verification-06/implementation-progress.md` and the named logs. They are superseded by run 15 where applicable, not erased.

## Visual and source review

The new away/toward source contact sheets and full-body loop sheets were inspected frame by frame. Toward's initial heel seed was rejected in favor of the toe seed; away uses a wider registration search for its coarse source pose increments. The final five stancecam sheets were opened and inspected: side (`road/side-near`), away (`road/away-far`), toward (`road/toward-near`), away diagonal (`road/diagonal-away-right`), toward diagonal (`alley/toward-far`). The actual final stance on each sheet has the stated cycle; filenames alone are not treated as proof of cycle coverage. The planted boots stay on their fixed crosshairs; toe roll and swing-foot motion remain visible. The away source is visibly coarser than toward. This visual foot review does not override the speed, freeze or exit failures.

## Raw acceptance outputs

'''
for title,file in [('python3 tmp/walkqa/tools/lockcheck.py <every final-06 mp4 path>','lockcheck-final.jsonl'),('python3 tmp/walkqa/tools/walkstats.py tmp/walkqa/final-06','walkstats-final.txt'),('Additional eroded-body/frame-count audit','audit-final.txt')]:
 text=(v/file).read_text();text=text.split('\n')[0]+'\n' if file=='audit-final.txt' else text
 s+=f'### `{title}`\n\n```text\n{text.rstrip()}\n```\n\n'
s+='### Stancecam\n\nEach command uses `tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py <clip> <out.png> 2`. All five output images were inspected.\n\n'
for name,clip in [('side','road/side-near'),('away','road/away-far'),('toward','road/toward-near'),('away-right','road/diagonal-away-right'),('toward-right','alley/toward-far')]:
 s+=f'`tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/stancecam.py tmp/walkqa/final-06/{clip}.mp4 tmp/walkqa/verification-06/stancecams/{name}.png 2`\n\n```text\n{(v/"stancecams"/(name+".txt")).read_text().rstrip()}\n```\n\n'
for title,file in [('freeze.py — all 63 clips','freeze-all.txt'),('Supplemental depth-speed audit (unchanged reviewer tools remain above)','depth-speed.txt')]:s+=f'### {title}\n\n```text\n{(v/file).read_text().rstrip()}\n```\n\n'
s+='## Engineering verification outputs\n\nThe final tests include the concurrent API tests present at verification time. The gameplay proof uses the isolated API revision below; these are distinct evidence boundaries.\n\n'
for file in ['tests-final.log','typecheck-engine-final.log','typecheck-game-final.log','typecheck-api-final.log','lint-engine-final.log','lint-game-final.log','lint-api-final.log','registration-tests.log','verify-art-final.log','town-final-live.log']:
 s+=f'### `verification-06/{file}`\n\n```text\n{(v/file).read_text().rstrip()}\n```\n\n'
s+='## Commits and provenance\n\nSmall commits were made on `open-world-mvp`, staged by explicit path. The following are this brief\'s commits; the concurrent `ecd9779` API commit is deliberately excluded.\n\n```text\n'
commits=subprocess.check_output(['git','log','--format=%h %s','c954abe..HEAD'],text=True)
s+='\n'.join(x for x in commits.splitlines() if not x.startswith('ecd9779'))+'\n```\n\n'
s+='''Final gameplay behavior is from `c86c99a` plus the ES2020 compatibility fix `ebb1bf9`; proof-session reset/identifier fixes are `b1c4cd8` and `03fd619`. `verification-06/provenance.json` records the captured source revision, unchanged reviewer-tool hashes, sprite metadata hashes, input-cache archive hash and town run. `proof-manifest.json` records every final video hash and exact frame count.

Concurrent API/floor derivation changes invalidated the cached road during an early replay. The failed cached road record was recovered from the already-loaded scene; the independent API/art work was preserved. Subsequent gameplay verification used committed API source from `d01daad`, API tree **b76e7694590455224b35936f1a49bd4711a3419b**, in an isolated runtime with a copied cache/database. Provider credentials were disabled. This is an integration test against that fixed API fixture, not a claim that the independently changing API pipeline passed the same journey. Final checkout API tests/typecheck/lint pass separately. `playtest-town.mjs --run=15 --ledger=tmp/walkqa/api-proof-env/api/data/calls.jsonl` recorded 69 calls, all cached.

The isolated runtime was removed after retaining its non-environment data/cache as `verification-06/api-proof-input-cache.tar.gz` for reproduction. Recreate a disposable checkout of the API source at the stated revision, restore that archive beneath its working root, and use the existing workspace dependencies/assets. The source and generated assets remain in the checkout. No credentials or dotenv files were written. The archive is local verification input, not a published artifact.

Generation total: **2 Kling, 1 BRIA, 0 image edits, 0 Veo**. Both Kling requests used existing keyframes; toward received BRIA. Away's upload was refused before BRIA submission and was processed with the local gray keyer. See `tmp/walkqa/calls.md`, `tmp/hermes-depth-06/REVIEW.md`, manifests, seeds and sheets. Concurrent `CALL 04a` entries are separate work and were not staged as this brief's costs.

## Cleanup

'''+(v/'cleanup.txt').read_text()+'\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n'
p.write_text("\n".join(line.rstrip() for line in s.splitlines())+"\n")
