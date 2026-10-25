# 24 Oct goal: anything the models generate is playable

Set by Gorka on 24 Oct 2026, evening. Runs overnight. Supersedes `FOOTFALL-GOAL.md`
as the active goal; that file and `FOOTFALL-BACKLOG.md` are history.

## Where this takes the system

Today Hermes walks well in the depot and on a black floor. By morning the claim is
larger: a place that the models paint and a character that the models draw both
arrive in the game playable, walking naturally, talking, with nobody tuning them.
Three tracks, one capstone.

## Track 1: any place

A background enters through the real pipeline (`POST /api/places`) and comes out
walkable: floor, scale, exits and occluders derived, and the walk on it natural by
the same rulers as the depot.

Done means:

1. All 13 existing scenes pass the walk suite under the lens: every exit fires once
   to the right place, every object approach ends facing it, near/far/left/right
   extremes arrive, a crossing behind the largest occluder draws in the right order,
   and on every walk the body moves every render frame at one ground speed, with
   one drawing per frame and planted feet (sole slide median under 1 px).
2. Hermes is a believable adult at near, middle and far in every scene, checked
   against something in the picture with a known size (a door, a bench, Kat), not
   against the formula that produced the scale.
3. Five scenes nobody has seen are generated tonight through the pipeline and pass
   the same suite untouched. A failure is fixed in the derivation code, never by
   editing that scene's data.
4. A pass/fail table per scene, with a real-canvas clip for every failure left.

## Track 2: any character

A character enters as one approved image and comes out with the full walk: direction
keyframes from an image model, cycles from a video model, cut by gait, audited for
drift and step symmetry, interpolated 4x, body-aligned, plus a stop and a pivot so
starts, stops and reversals stop being cuts. Hermes took weeks by hand; this is one
command (`sprite-tools/scripts/make-character.sh <image> <name>` or equivalent).

Done means:

1. Kat rebuilt through it tonight and walking beside Hermes in the depot, same
   rulers, same lab numbers.
2. A third character, drawn tonight from a prompt (FLUX 3 Max for the sheet image,
   then the same pipeline), walking in one of the five new scenes.
3. Hermes gains stop and pivot sheets through the same path; the lab shows a start,
   a stop and a 180-degree reversal without a visible cut.
4. Every sheet in the game passes `audit-drift`, `audit-steps` and `audit-skid`; the pipeline
   refuses to ship one that does not.

## Track 3: dialogue and the game

The open-world prompt shows a caption and three options. The game needs a dialogue
interface: who is speaking, the line, choices when there are choices, and the
narrator's captions, in one consistent panel that works for StoryScript dialogue
and the narrator alike. Then Act 1 is played for real.

Done means:

1. A dialogue panel in the game UI: speaker name and colour, line text, choice list,
   advance on click or key, voiced lines when TTS is cached, readable timing when
   not. Used by both StoryScript `DIALOGUE` blocks and the narrator's options.
2. Act 1 from `story/act1.story` playable from the bus depot to arrival in Innsmouth:
   talk to the clerk, Kat on the bench, board the bus, arrive. Hotspots that the
   story names exist in the scenes and do what the script says.
3. The two characters walk and talk in the same scene without the motor and the
   dialogue fighting over who owns Hermes.

## Capstone

A continuous real-time recording through `window.__anima.record`: depot, a
conversation with Kat, the bus, Innsmouth, two generated places with exits firing,
the third character in one of them. Rendered by the lens, waiting in
`tmp/recordings/` in the morning with the scene table.

## How the night runs

- Codex does the grind from written briefs in `tmp/overnight/briefs/`; Claude writes
  the briefs, verifies every result with its own tools (the lens, the lab, the sheet
  audits, frame strips), and loops. No result is accepted on a report.
- Rulers before features: a change that breaks a walk number is reverted, not argued.
- Paid calls are planned, not incidental: Veo or Seedance for cycles (about 20 clips),
  FLUX 3 Max for keyframes and the third character, BRIA for mattes, the place
  pipeline's own image and perception calls for five scenes. Nothing else.
- Commit by path as each piece lands. No push, no deploy.
- Status file and board updated when a track completes, not per step.
- Anything blocked on Gorka is written in `tmp/overnight/BLOCKED.md`, not guessed.

## Track 4: the whole story

Acts 1 to 4 exist in `story/*.story`. With the dialogue panel working, play them: every
scene the story names gets a place (authored or generated through the pipeline), every
hotspot the story names exists, and the acts run end to end. Where art is missing the
panel says so and the story keeps flowing; the missing-art list is part of the report.

## Track 5: the cast

Every named NPC the acts reach gets a walking sprite through `make-character.mjs`: the
clerk, the bus driver, Zadok, the Gilman House desk man, and whoever else Act 1 to 4
put on screen. One image each, then the pipeline. Same audits as Hermes.

## Track 6: the swarm

AI player archetypes (the curious one, the rusher, the completionist) drive the acts
through `window.__anima` and the narrator, hundreds of sessions, and report every dead
end, unreachable hotspot and broken transition into one table. This is how Acts 2 to 4
get tested overnight without a human clicking every branch, and it warms the caches.

## Not tonight

Video moments (paid, slow, nothing plays them yet), stairs (the floor model has no
height), 16-direction walks (cheap now, but the eye does not tell 22.5 degrees apart at
this sprite size; revisit if a scene shows the gap).
