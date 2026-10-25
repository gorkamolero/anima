# Story swarm

120/120 live browser sessions complete; 120 passed. No LLM calls. Every action uses the real canvas and dialogue events.

Policies: rusher follows the shortest authored exit route; curious exhausts available observations and conversations before travel; completionist also balances choices across runs. Both clerk-interest initial conditions are exercised at the reef. Session seed alternates rescue exits. Narrative-only actions are valid when they produce text; a missing state change alone is not a failure.

| Session | Act | Policy | Failure | Status | Trace |
|---|---|---|---|---|---|
| probe | 2 | curious | session failure: Error: Transition/dialogue failed to settle | Fixed: isolated authored state from preview persistence | tmp/overnight/reports/story-probe.json |
| probe | 2 | curious | error thrown: Error: Unable to save world | Fixed: isolated authored state from preview persistence | tmp/overnight/reports/story-probe.json |
| recorded probe | 3b | curious | session failure: Error: Transition/dialogue failed to settle | Fixed: long cutscene wait budget and reused same-place geometry | tmp/overnight/reports/act3b-driver-timeout.json |
| initial-2 | 3 | curious | runner error: Error: Timed out: !!window.__anima?.scene.getReviewQaSnapshot().story && !!window.__anima?.scene.getReviewQaSnapshot().dialogue | Fixed: readiness waits for controller instead of transient line | tmp/overnight/reports/swarm-initial/session-002.json |
| initial-3 | 3b | curious | runner error: Error: Timed out: !!window.__anima?.scene.getReviewQaSnapshot().story && !!window.__anima?.scene.getReviewQaSnapshot().dialogue | Fixed: readiness waits for controller instead of transient line | tmp/overnight/reports/swarm-initial/session-003.json |

## Choice coverage

| Scene and choices | Selections per option |
|---|---|
| confrontation_setup / I came to bring you home. / I know what you're becoming. I saw the photos. / Schoeppi needs you. | 20, 15, 13 |
| confrontation_setup / I'm not leaving without you. / Come with us. Please. / Take Schoeppi and go | 11, 8, 5 |
| the_beach / I can't. / I wish I could. / Take me with you. | 11, 8, 5 |
| confrontation_setup / I'll follow you anywhere. / I can't. / Then let me hear your choice. / Let me try to save you. | 6, 2, 6, 10 |
| confrontation_setup / Step into the water / Hesitate | 4, 4 |
| grocery_store / I'm researching the history of Innsmouth. / Do you know the Marsh family? / Never mind. | 4, 6, 6 |
| pier_meeting / What are the Deep Ones? / What kind of trade? | 11, 13 |
| pier_meeting / What happens when they change completely? / And Dagon? The church? | 11, 13 |
| confrontation_setup / I'm coming. / ...You're right. | 2, 2 |
| confrontation_setup / Then let me stay with you. / Don't do this. / ...Okay. | 2, 2, 2 |
| rescue_choice_left / Pull her along / Let her lead | 2, 2 |
| rescue_boat / Hold out your hand / You have to choose. | 2, 2 |
| surface_she_leaves / Search her things / Don't look | 3, 2 |
| rescue_choice_right / Can you swim us out? / Push through to the boat | 4, 2 |
| rescue_swim / Reach for her / Come with us! | 2, 2 |
| rescue_boat_race / Pull her into the boat / It's okay. Go to them. | 1, 1 |

Traces: one JSON per session in `tmp/overnight/reports/swarm/`. A pass requires an authored act/game ending, matching declared hotspot presence, reachable click targets, and no thrown errors or unknown transitions. This tests story interactions; the walking suite remains Track 1's responsibility.
