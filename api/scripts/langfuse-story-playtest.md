# Innsmouth AI playtest

Run from `api`:

```sh
pnpm exec tsx scripts/langfuse-story-playtest.ts --variant=curious-explorer --acts=act1,act4 --run-name=innsmouth-curious-explorer-01
```

Add `--dry-run` to exercise the same dataset upserts, task, player loop, structured AI SDK output, and item/run evaluators with in-memory transports. This mode never initializes credentials, provider clients, or telemetry exporters. Mock judgments are fixtures, not quality assessments. Omit `--acts` for all five acts. The live dataset always upserts all five using stable IDs, retaining the hosted dataset items when selecting the experiment subset. `full_game` is excluded. A source digest records the version evaluated.

Options: `--variant=curious-explorer|impatient-player`, `--player-model=google/gemini-2.5-flash`, `--judge-model=google/gemini-2.5-pro`, `--max-actions=12`, `--max-scenes=20`, `--max-model-calls=120`, `--run-name=<unique-name>`. Use distinct run names for independent comparisons.

The action limit applies cumulatively to each scene ID, including invalid decisions and revisits. The scene limit counts visits, including automatic scene transitions. An optional runtime guard stops automatic loops at that boundary; normal runtime callers retain existing behavior. Each player decision and each scene/act judge invocation counts toward the shared 120-call limit, including failed attempts. SDK retries are disabled and calls time out after 90 seconds. The loop reserves calls for the current scene and final act judgment. Under very small caps, judgments can be missing; the report records unjudged scenes and evaluator errors. An unavailable metric is omitted rather than assigned an invented score.

With S scene visits and A decisions, calls are A + S + 1 (scene judgments plus one act judgment), at most 120 with defaults. A rough budget is 13S + 1 before the total cap: 5 visited scenes can use up to 66 calls; 10 up to 120. Real paths usually finish or hit the per-scene action cap sooner. No live cost or call estimate has been measured.

Player prompts contain rendered output, inventory, hotspot names/verbs, dialogue options, and prior player experience. They exclude action implementation, hidden flags, unvisited story text, and judge verdicts. Judges receive the recorded transcript. Scene scores average repeated visits per scene before averaging across scenes. Endings come strictly from runtime state; cross-act references are reported by `validateStoryGraph`, not silently treated as endings. Each act starts independently with the runtime's default state, so missing prerequisites and cross-act links remain visible.

Cost sums the provider's OpenRouter usage cost for all calls. Missing or failed-call accounting produces `costUsd: null`, an explicit known subtotal, and no `cost_usd` score. This avoids reporting unknown spend as zero. The offline mock reports zero cost.

Tracing uses `play-story-act` as the trace name and playback span under the SDK's automatic experiment wrapper, `play-scene` per visit, AI SDK `choose-action` generations, and `judge-scene`/`judge-act` evaluators containing AI SDK generations. Dynamic act/scene/persona values are inputs or metadata. The existing Langfuse shutdown helper flushes the client and processor. Live trace export and judge calibration still require the authorized real experiment.

References: [Langfuse SDK experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk), [AI SDK telemetry](https://langfuse.com/integrations/frameworks/vercel-ai-sdk), [trace best practices](https://langfuse.com/docs/observability/best-practices). Implementation uses the repository's installed SDK 6.1.1.
