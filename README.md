# Picomon Stadium

A proof of concept for joining a room with a 4-character code. One player creates a room and waits; a second player enters the code and joins. Both screens update live to show each other's names. Built with Next.js 16, Turso (via Drizzle) for storage, and Ably for realtime updates.

- Design spec: [docs/superpowers/specs/2026-10-16-room-join-poc-design.md](docs/superpowers/specs/2026-10-16-room-join-poc-design.md)
- Realtime options research: [docs/research/2026-10-16-realtime-options.md](docs/research/2026-10-16-realtime-options.md)

## Setup

### 1. Create accounts

- **Ably:** sign up (free, no card), create an app, and copy the **root API key**. This is `ABLY_API_KEY`.
- **Turso:** sign up, create a database, and copy its URL (`libsql://...`). This is `TURSO_DATABASE_URL`. Then create a database token. This is `TURSO_AUTH_TOKEN`.

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in `ABLY_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`. Never commit `.env.local`. It holds secrets and is git-ignored.

### 3. Install dependencies

```bash
npm install
```

### 4. Apply database migrations

```bash
npm run db:migrate
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Apply migrations to the Turso database |
| `npm run db:generate` | Generate a new migration after schema changes |
| `npm run dev` | Start the local dev server at http://localhost:3000 |
| `npm test` | Run the test suite (Vitest) |
| `npm run build` | Produce a production build |

## Testing alone

Each browser holds one player, by design. To test with two players from one machine:

1. Start the app with `npm run dev` and open http://localhost:3000 in a normal window. Enter a name and host a room.
2. Open a private/incognito window (or use a second browser) to http://localhost:3000. Enter a different name and join with the room code.

Both windows should show each other's names without a refresh.

## Deploying to Vercel

1. Import this repository in Vercel.
2. Add `ABLY_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` as environment variables for both **Production** and **Preview**.
3. Deploy.

Vercel does not run migrations during build. Run `npm run db:migrate` against the Turso database once before using a new deployment.
