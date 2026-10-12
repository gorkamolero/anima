# Brief 04b — asymmetric floor judge

All six corpus places and both regression places are stored as `ground: "derived"`; their final GETs on API port 4700 returned 200. Every final hazard probability is below 0.6. This is a conservative floor-eligibility result, not Footfall walking signoff or proof of full floor coverage.

## Final implementation

- `floor-judge.ts` submits typed questions to `POST https://openrouter.ai/api/alpha/decisions`, model `openai/gpt-6-luna-decisions`. The image-state probe returned HTTP 400, `Decision input exceeds the token limit`; the requested Gemini fallback was used. No credentials or image request payloads were logged.
- Each overlapping labelled object gets a separate noul question, plus global water/sky/wall and unlabelled-obstacle checks. Standable surface labels (dock, street, rug, stairs, etc.) are coverage-only notes. Every hazard probability >= 0.6 rejects the candidate. Coverage never rejects.
- The fallback asks each question in a separate call. It returns yes/no plus confidence, converted to P(yes), avoiding confusion between certainty in a negative answer and probability of a positive answer. Coverage is a separate score. Questions, answers, probabilities, evidence, provider/fallback reason and exact overlay are retained. Cache keys use decoded pixels, exact questions and evaluator version.
- Cached SAM obstacle masks and available occluder alpha masks are subtracted before judging. Rejections cause further subtraction, never expansion: labelled boxes, or separately localized suspected hazards with conservative clearance. Localization cannot overrule a probability. A changed mask is judged again. Unresolved or operational failures still fail closed.
- Stair pixels require a nonempty regional scale table from valid positive depth samples. Unscaled stair pixels are removed and noted. Repairs intersect all regions with the remaining floor and rebuild the supported six-point line. The perception cache remains version 7; the judge is `asymmetric-v3-signed-confidence`.
- Both POST `/api/places` and POST `/api/ground` use the gate. Existing places no longer implicitly rederive solely because a derivation version changes; `refresh:true` is explicit. Broad sprite-placement judgments no longer reject floor eligibility.

## Final evidence

The six requested named overlays are `tmp/walkqa/derivation/<key>-overlay.png`. Exact grayscale/green judge images are `<key>-04b-review.png`; probability tables are `<key>-04b-probabilities.md` and `.json`. Each JSON contains the exact question text and evidence. Final place snapshots are `<key>-04b-result.json`. Earlier failed candidates, batched/independent judge iterations and localization records remain in the same directory and place-ID subdirectories.

| Scene | GET | Ground | Regions / stairs | Max hazard P | Coverage score (note only) |
|---|---:|---|---:|---:|---:|
| pier | 200 | derived | 5 / 0 | 0.000 | 0.80 |
| stepped-street | 200 | derived | 3 / 2 | 0.000 | 1.00 |
| church | 200 | derived | 3 / 0 | 0.000 | 1.00 |
| lobby | 200 | derived | 6 / 2 | 0.000 | 1.00 |
| grocery | 200 | derived | 4 / 0 | 0.000 | 0.50 |
| square | 200 | derived | 6 / 0 | 0.000 | 1.00 |
| road | 200 | derived | 0 / 0 | 0.000 | 1.00 |
| alley | 200 | derived | 0 / 0 | 0.000 | 1.00 |

## What the reviewer should inspect

The model's coverage scores are visibly overconfident in several scenes (including 1.0 despite missing floor). These are model estimates, not measured coverage or empirically calibrated error rates. The fallback also gave contradictory global/object judgments during development. No rejection was manually overridden; the cost of satisfying it is extra missing floor. This remains a judge-quality limitation.

- **pier:** Conservative margins and disconnected deck strips remain; gaps showing water stay excluded.
- **stepped-street:** Extra net exclusions leave a narrow central lower-step route. Left dock and much of the upper staircase are now omitted. Two surviving stair regions retain their derived scales.
- **church:** Central aisle remains usable. Thin floor fragments beside pew edges and raised rear area are omitted.
- **lobby:** Floor and rug remain usable. Only lower stair patches are included; two derived stair-scale regions remain.
- **grocery:** Central aisle and front floor remain. Conservative removal excludes the right doorway dock and foreground barrel vicinity.
- **square:** Rear wooden deck is omitted; complete passage behind the fountain is not established.
- **Road:** final `road-04b-overlay.png` shows a much narrower central road mask after conservative box subtraction. Side approaches and some edge connectivity were sacrificed. Original floor and all rejected reviews remain archived.
- **Alley:** final `alley-overlay.png` shows a foreground walking area only; the deep route toward the gargoyle is now omitted. Existing walking targets/exits need a new walking-agent review. No motor, sprite, scene or render-script changes were made here.

Thus road and alley pass the final safety judge, but they did **not** pass unchanged. Missing routes are explicitly reported rather than hidden behind the derived flag. Stair coverage is likewise partial, with two active stair regions each in lobby and stepped street.

## Verification and budget

- API tests: 80 passed across 15 files. Includes inclusive 0.6 threshold, missing coverage, valid probability requirements, decision transport/fallback, signed confidence conversion, subtraction, localization, stairs, and explicit-refresh compatibility.
- API typecheck and lint passed. Logs: `tmp/walkqa/logs/04b-tests.log`, `04b-typecheck.log`, `04b-lint.log`.
- All eight persisted GETs returned 200. Every six-point line was sampled at 5,005 positions with zero samples outside its mask. For every place with regions, regions are disjoint and their union equals the floor; all scale tables are finite and within 0.18–1.5. See `04b-geometry-checks.json`.
- Positive control: deliberately marking the upper sky band green produced environment probability 1.0 and was rejected. See `04b-positive-control-probabilities.json`. The earlier thinner sky-band control was missed by the environment question; its raw review is retained. This reinforces the judge-quality limitation above.
- **0 additional segmentation/depth calls**; the shared 04a ledger remains **86/120**. **14 decision-endpoint attempts** including probes/restarted processes, below 200. Image state was rejected; Gemini fallback produced 395 question answers across 60 cached review records (earlier records batched multiple answers); there were 8 additional localization records. These are separate, more expensive Gemini requests, not the cheap decision endpoint. Their results are archived. No image-generation/edit calls and no video calls; only diagnostic overlays were rendered.
- No push, merge, deployment or GitHub settings changes. Only derivation code/tests and this brief's report/manifest/probability records are included in the commit. Other agent files are excluded.

Port 4700 was stopped; `lsof -nP -iTCP:4700 -sTCP:LISTEN` confirmed no listener. Other services were left running.
