# Brief 34 — first-attempt generalisation

Three sequential `POST /api/places` requests, without retries, rederivation or production changes. [Exact requests](requests.json), [returned records](generalisation.json), [scene images](new-scenes.png), [call audit](generation-audit.json).

| Scene | Stored place | Result |
|---|---|---|
| Rocky beach | place-a53d08124ed6c715c32e | FAIL: `Occluder segmentation budget exhausted (120 calls)` |
| Cramped cellar | place-675c8639872575208930 | FAIL: `Occluder segmentation budget exhausted (120 calls)` |
| Fog-bound graveyard | place-a3da054dbc2afb584327 | FAIL: `perception budget exhausted` |

All responses are HTTP 200 with `ground: failed`, an empty floor and travel disabled. The QA package's `generateWalkPlan` throws `Cannot generate walks for an empty walk area` for each actual returned floor. Consequently there are no runnable new-scene walks, simulator frames, reviewer frame checks, compositor sheets or recordings. These are failures of the requested unattended pipeline in this checkout, not measured failures of walking on usable geometry. No scene was replaced or tuned.

The three generated images were inspected: beach has rocks and tide pools; cellar has crates and a ladder to a hatch; graveyard has headstones and an iron fence. Images succeeded; the fourth permitted image retry was unused. The derivation's cumulative limits were left intact. The global perception reservation count rose from 165 to 200, including reservations blocked by the separate segmentation counter before network submission. The runner recorded **3 image edits and 2 actual SAM queue submissions; 0 depth submissions and 0 generative videos**. Even counting all 35 perception reservations as attempts remains below the brief's 40-call budget.

Exact HTTP records: [beach](rocky-beach-creation.json), [cellar](cramped-cellar-creation.json), [graveyard](fog-graveyard-creation.json). Existing derivation overlays are linked by absolute path in those records. Failed places remain stored for inspection. The standard `GET /api/places` excludes failed records; therefore `verify:art --generated` cannot establish success for these three places.
