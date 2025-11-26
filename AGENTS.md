# Repository Guidelines

## Project Structure & Modules
- `src/` holds the TypeScript entrypoints: `index.ts` runs the CLI processor, `server.ts` serves the moderation UI/API, `gptClient.ts` wraps the OpenAI SDK, `tweetStore.ts` handles SQLite persistence, and `prompt.ts` is the system prompt.
- `migrations/` contains ordered `.sql` files executed by `npm run migrate`.
- `public/` serves the web UI assets; `dist/` is emitted output from the TypeScript build.
- `scripts/run-migrations.mjs` is the migration runner; Dockerfile and `docker-compose.yml` mirror the same flow for container usage.

## Setup, Build, and Development Commands
- Install deps: `npm install`.
- Type-check only: `npm run lint` (tsc with `--noEmit`).
- Dev loop: `npm run dev` (tsx runs `src/index.ts` for the CLI fetch/judge loop).
- Build: `npm run build` → outputs to `dist/`; run compiled CLI with `npm start`.
- Web dashboard: `npm run web` (serves `dist/server.js` or `src/server.ts` via tsx in dev).
- Migrations: `npm run migrate [./path/to/db.sqlite]`.
- Docker: `docker build -t kaspa-handsfree .` then `docker run -p 4000:4000 -e OPENAI_API_KEY=… -v "$(pwd)/data:/data" kaspa-handsfree`.

## Configuration & Security Notes
- Required: `OPENAI_API_KEY` for both CLI and re-evaluation endpoints.
- Optional: `SQLITE_DB_PATH` (default `data/app.db`), `PORT` (default `4000`), `ADMIN_PASSWORD` to gate `/api/tweets` quotes and POST routes.
- The CLI pulls tweets from `https://kaspa.news/api/kaspa-tweets`; keep that in mind for network-restricted runs.

## Coding Style & Naming
- Language: strict TypeScript (NodeNext modules). Use named exports where practical.
- Formatting: 2-space indent, semicolons, single quotes/templated strings as in existing files; favor small, pure helpers.
- Prefer short, imperative function names (`askTweetDecision`, `createTweetStore`) and DTO-like types suffixed with `Input`/`Record`.
- Keep prompt edits in `src/prompt.ts` focused and documented in PR notes.

## Testing Guidelines
- No automated test suite yet; when adding, prefer lightweight unit coverage around `tweetStore` and `gptClient` using Node’s built-in test runner or vitest.
- For changes touching migrations or API filters, verify `npm run migrate` against a temporary DB and hit `/api/tweets?approved=true` and `/api/tweets?humanDecision=UNSET` locally.
- Run `npm run lint` before submitting to catch type regressions.

## Commit & Pull Request Guidelines
- Commits follow short, imperative subjects (see `git log`: “Update prompt”, “Add score field”). Keep scope tight.
- PRs should include: purpose summary, testing commands run, and any env var or migration impacts. Add UI screenshots when touching `public/` or API responses.
- Link related issues and call out breaking changes (API shape, DB schema) explicitly in the description.
