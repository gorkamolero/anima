# stepped-street — final floor probabilities

Provider: google/gemini-2.5-flash. Threshold: hazard probability >= 0.6. Coverage and standable-surface overlap are notes.

Exact judged overlay: `stepped-street-04b-review.png`

| Question | Type | Probability | Role |
|---|---|---:|---|
| Is the physical area of the labelled object "left house" at normalized bounds [0, 0, 0.407, 0.771] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion. | noul | 0.000 | hazard |
| Is the physical area of the labelled object "right house" at normalized bounds [0.593, 0, 1, 0.771] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion. | noul | 0.000 | hazard |
| Is the standable surface "cobblestone street" marked walkable in GREEN? This is a coverage note, not a hazard. | noul | 1.000 | note |
| Does GREEN cover water, sky or walls? Only green pixels count; missing floor is never an error. | noul | 0.000 | hazard |
| Does GREEN cover any non-standable furniture, counters, pews, crates, barrels, nets, fences, posts, railings or other obstacles, including unlabelled ones? Ignore missing floor and intentional clearance margins. | noul | 0.000 | hazard |
| Estimate the fraction of visible standable floor covered by GREEN, from 0 to 1. Missing floor is a coverage note only and never a rejection. | score | 1.000 | note |
