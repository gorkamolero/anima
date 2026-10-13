# Brief 20 harness

Run from the checkout root. The report is `reports/20-ten-scene-harness.md`; full local evidence is in `harness-20/`. The run is FAIL, and the report explicitly lists unfinished repair and coverage requirements.

Use only API **4317** and game **8080**. The capture URL always includes `?mute=1`. Do not reuse or stop owner ports 4410/8090. Start the API with `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `FAL_KEY`, `FAL_KEY_ID`, `FAL_KEY_SECRET`, and `ELEVENLABS_API_KEY` explicitly empty in its environment; do not write an environment file. Use existing cached assets and responses. Stop only the processes you started.

Dependencies: Node, Playwright Chromium, ffmpeg/ffprobe, Python with numpy, scipy, Pillow, opencv-python and shapely. The local Python environment is `tmp/walkqa/tools/venv`. `PLAYWRIGHT_MODULE` can point to an installed Playwright `index.mjs`; otherwise the harness uses a local package or npm execution cache.

```sh
node tmp/walkqa/harness20.mjs --probe
tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/plans20.py
node tmp/walkqa/catalog20.mjs
node tmp/walkqa/harness20.mjs
tmp/walkqa/tools/venv/bin/python tmp/walkqa/tools/check20.py
python3 tmp/walkqa/tools/videoalign20.py
```

`--scene=outside --walk=near-left` selects a case. `--redo` replaces its evidence: archive the old case first when retaining before/after proof. Capture reloads between walks, steps at 24 fps and encodes each rendered PNG. The default cap is 2400 frames; `--max-frames=N` changes it. A forced timeout stop is recorded as failure, never completion. The inside deepest retained run used a 960-frame cap.

`--experiment=tight-stop` and `--experiment=heading-and-stop` apply the retained motor trials only in the QA browser. `baseline_trials20.py` prepares `baseline-linear` and `baseline-silhouette` overrides, used with the corresponding experiment argument. These do not edit cached assets or source files.

Review every contact sheet and every image returned by `reviewqueue20.py <scene> <start-index> <end-index>`. It does not mark anything reviewed. Only after inspection, record the result with `markreview20.py <scene> <walk> pass|fail <observation>`. Manifests preserve image hashes. Regenerating changed review images invalidates prior review.

```sh
python3 tmp/walkqa/tools/report20.py
```

The aggregator never promotes absent evidence to a pass. `results.json` contains full metrics and `pass_`; capture/review completion is separate from the explicitly incomplete repair loop. Existing reviewer tools are called unchanged. The pre-existing owner modification to `walkstats.py` was preserved.

Each new metric checker supports `--self-test`, rejecting a deliberately broken case. Self-test evidence, source regression logs, art verification, credential-disabled town replay and server cleanup records are retained under `harness-20/`. The report describes measurement limits: runtime nearest-point preview, heuristic gap selection, body-origin path distance and pixel-height tracking through occlusion/transitions require further work.
