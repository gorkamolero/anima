# grocery — final floor probabilities

Provider: google/gemini-2.5-flash. Threshold: hazard probability >= 0.6. Coverage and standable-surface overlap are notes.

Exact judged overlay: `grocery-04b-review.png`

| Question | Type | Probability | Role |
|---|---|---:|---|
| Does GREEN cover water, sky or walls? Only green pixels count; missing floor is never an error. | noul | 0.000 | hazard |
| Does GREEN cover any non-standable furniture, counters, pews, crates, barrels, nets, fences, posts, railings or other obstacles, including unlabelled ones? Ignore missing floor and intentional clearance margins. | noul | 0.000 | hazard |
| Estimate the fraction of visible standable floor covered by GREEN, from 0 to 1. Missing floor is a coverage note only and never a rejection. | score | 0.500 | note |
