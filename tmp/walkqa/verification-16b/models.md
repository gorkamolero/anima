# First/last-frame model check, 2026-10-12

Checked current fal model pages and API schemas before submitting. Shortest advertised outputs, ordered by minimum clip price among the checked supported endpoints:

| Endpoint | Minimum used/available | Listed minimum price | Start/end fields |
|---|---|---|---|
| `alibaba/wan-3.0/image-to-video` | 2s, 480p | $0.10 ($0.05/s) | `start_image_url`, `end_image_url` |
| `fal-ai/wan-flf2v` | 81 frames, 24fps, 480p | $0.20 | `start_image_url`, `end_image_url` |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | 5s | $0.35 | `image_url`, `tail_image_url` |
| `fal-ai/veo3.1/fast/first-last-frame-to-video` | 4s, 720p, no audio | $0.40 | `first_frame_url`, `last_frame_url` |
| `fal-ai/veo3.1/first-last-frame-to-video` | 4s, 720p, no audio | $0.80 | `first_frame_url`, `last_frame_url` |

Kling 2.1 Pro is explicitly marked deprecated. Brief 16's Kling v3 turbo standard schema has no end-image field, so it was not reused.

Sources:
- https://fal.ai/models/alibaba/wan-3.0/image-to-video/api
- https://fal.ai/learn/tools/how-to-use-wan-3
- https://fal.ai/models/fal-ai/wan-flf2v/api
- https://fal.ai/models/fal-ai/wan-flf2v
- https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/api
- https://fal.ai/explore/image-to-video-apis
- https://fal.ai/models/fal-ai/veo3.1/fast/first-last-frame-to-video/api
- https://fal.ai/models/fal-ai/veo3.1
- https://fal.ai/models/fal-ai/kling-video/v2.1/pro/image-to-video
- https://fal.ai/models/fal-ai/kling-video/v3/turbo/standard/image-to-video/api

Prices are advertised estimates, not a provider invoice. All submitted requests are counted against the 12-video cap, irrespective of output acceptance.
