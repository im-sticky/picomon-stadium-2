# Picomon Stadium

An online multiplayer Pokemon Stadium game made as if it was on the Game Boy Colour. Specced, architected, designed, and developed strictly through the use of agentic AI as a project to help better learn AI driven development.

Built with Next.js 16, Turso (via Drizzle) for storage, and Ably for realtime updates.

- Live: https://picomon-stadium-2.vercel.app

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

| Command               | What it does                                        |
| --------------------- | --------------------------------------------------- |
| `npm run db:migrate`  | Apply migrations to the Turso database              |
| `npm run db:generate` | Generate a new migration after schema changes       |
| `npm run dev`         | Start the local dev server at http://localhost:3000 |
| `npm test`            | Run the test suite (Vitest)                         |
| `npm run build`       | Produce a production build                          |

## Testing alone

Each browser holds one player, by design. To test with two players from one machine:

1. Start the app with `npm run dev` and open http://localhost:3000 in a normal window. Host a room.
2. Open a private/incognito window (or use a second browser) to http://localhost:3000. Join with the room code.

## Deploying to Vercel

1. Import this repository in Vercel.
2. Add `ABLY_API_KEY`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` as environment variables for both **Production** and **Preview**.
3. Deploy.

Vercel does not run migrations during build. Run `npm run db:migrate` against the Turso database once before using a new deployment.

## Credits

- **[Polished Crystal](https://github.com/Rangi42/polishedcrystal)** by Rangi42 and contributors: Pokémon sprites, and modifications to Pokémon data.
- Pokémon is © Nintendo, Creatures Inc. and GAME FREAK inc. This is an unofficial fan project and is not affiliated with or endorsed by them.
