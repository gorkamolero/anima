# Brief 24: facing truth

Status: in progress; acceptance not established.

Baseline: 83e5099, open-world-mvp. Read goal, brief 23, findings F22-F24 and last 12 commits. Preserving pre-existing calls.md, reviewer walkstats.py and AgentDebug.test.ts changes. Reviewer tools are read-only. Owner ports 4410/8090 untouched; QA 4317/8080, mute=1. No generation; segmentation 0/10.

## Work log

- Baseline reports 42 time-budget searches among 139 walks. Facing gate replaced by reviewer stance checker for brief 24; pixel height uses exact-frame expected height and requires at least 50% measurable frames.
- De-drift attempt 1 rejected before writing because original sheet bounds clip translated boots. Attempt 2 uses transparent padding, preserving every alpha pixel. Retracked contacts agree with exact source contacts plus translation to <0.01 px on all three corrected cycles; diagonal art remains unchanged. Viewed all 85 corrected frames in contact sheets. The original toward stance has an off-boot keypoint at its wraparound; raw kpcheck also confuses visually similar boots on unchanged diagonal frames. These are not called passes.
- Added data-driven sheet frame dimensions so padded sprites are decoded correctly. Worker uses the same production simulator with a 5 s / 250,000 node cap and 1.2 m turn cost. Facing selection compares actual first/last body samples using the reviewer view-ray sign; every prospective stop continuation is checked too.
