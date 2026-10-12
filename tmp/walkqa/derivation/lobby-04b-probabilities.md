# lobby — final floor probabilities

Provider: google/gemini-2.5-flash. Threshold: hazard probability >= 0.6. Coverage and standable-surface overlap are notes.

Exact judged overlay: `lobby-04b-review.png`

| Question | Type | Probability | Role |
|---|---|---:|---|
| Is the physical area of the labelled object "reception desk" at normalized bounds [0.09, 0.395, 0.485, 0.69] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion. | noul | 0.000 | hazard |
| Is the standable surface "stairs" marked walkable in GREEN? This is a coverage note, not a hazard. | noul | 0.000 | note |
| Is the standable surface "rug" marked walkable in GREEN? This is a coverage note, not a hazard. | noul | 1.000 | note |
| Is the physical area of the labelled object "desk-0" at normalized bounds [0.09739583333333333, 0.5231481481481481, 0.3697916666666667, 0.8407407407407408] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion. | noul | 0.000 | hazard |
| Is the physical area of the labelled object "railing-0" at normalized bounds [0.4166666666666667, 0.25277777777777777, 0.5552083333333333, 0.7027777777777777] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion. | noul | 0.000 | hazard |
| Does GREEN cover water, sky or walls? Only green pixels count; missing floor is never an error. | noul | 0.000 | hazard |
| Does GREEN cover any non-standable furniture, counters, pews, crates, barrels, nets, fences, posts, railings or other obstacles, including unlabelled ones? Ignore missing floor and intentional clearance margins. | noul | 0.000 | hazard |
| Estimate the fraction of visible standable floor covered by GREEN, from 0 to 1. Missing floor is a coverage note only and never a rejection. | score | 1.000 | note |
