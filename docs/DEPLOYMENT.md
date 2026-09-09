# Web Deployment Checklist

Anima deploys as two parts:

- `@anima/shadow-over-innsmouth`: static Vite build.
- `@anima/api`: Node/Hono API for sessions and optional TTS.

## Required Gates

Run these from the repository root before deploying:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

## Static Game

Build output:

```bash
pnpm --filter @anima/shadow-over-innsmouth build
```

Deploy `adventures/shadow-over-innsmouth/dist` to static hosting. The production Vite build uses `base: "./"` so it can be served from a subdirectory or static bucket.

Set this environment variable at build time when the API is hosted somewhere other than local development:

```bash
VITE_API_BASE_URL=https://your-api.example.com/api
```

If the API is unavailable, the game falls back to browser local storage for saves.

## API

Build output:

```bash
pnpm --filter api build
```

Start command:

```bash
pnpm --filter api start
```

Environment:

```bash
PORT=3001
ELEVENLABS_API_KEY=optional-for-tts
ELEVENLABS_DEFAULT_VOICE_ID=optional
TTS_MODEL_ID=optional
TTS_STABILITY=optional
TTS_SIMILARITY_BOOST=optional
```

The API currently stores sessions in memory. Use a single Node process for this deployment pass; persistent database-backed saves are a follow-up before public launch.

## Smoke Test

After deployment:

1. Open the game URL.
2. Confirm the first scene is `Arkham Bus Depot`.
3. Use `Ticket Window -> talk`, choose a ticket option, and verify inventory includes `bus_ticket`.
4. Use `Bus Platform -> use` and confirm the scene advances.
5. Refresh the browser and confirm the current scene/inventory restore.
6. Check API logs for `POST /api/session` and `PATCH /api/session/:id` when `VITE_API_BASE_URL` is configured.
