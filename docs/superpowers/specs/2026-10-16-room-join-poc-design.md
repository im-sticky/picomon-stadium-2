# Room Join Proof of Concept — Design

*Date: 2026-10-16 · Status: approved by the user*

## 1. Intent

This is the first piece of an online two-player game website. The game itself will eventually be a simple Pokémon Stadium-style turn-based battle, but **that is not part of this document.**

What we are building now is a **proof of concept for connecting two players**: one person hosts a room and gets a short code, sends that code to a friend through a messaging app, the friend enters it, and both people end up on the same screen seeing each other's names — live, without refreshing.

If this works reliably on the real deployed site between two different devices, the foundation for the game is proven.

## 2. Goals, non-goals, anti-goals

**Goals**
- A host can create a room and see a short room code.
- A second person can join that room with the code.
- The host's waiting screen switches to the room screen **automatically** the moment the friend joins.
- Both players see both names.
- Refreshing the page keeps you in your room.
- Runs on Vercel, free, with no credit card required anywhere.

**Non-goals (for this PoC)**
- Any game or battle logic.
- Visual styling. Screens are plain wireframes. *(Future direction, not for now: the look will be modeled on Pokémon Crystal / Gen 2.)*
- User accounts, logins, passwords — ever. Rooms and the players in them are ephemeral, one-time things: they exist only for that game and are thrown away when the room expires.
- An online/offline indicator (Ably presence). Not needed.
- Leaving a room, kicking, "opponent disconnected" handling, rematches.
- Spectators or more than two people.
- Chat.

**Anti-goals (would make this a failure even if it "works")**
- The host has to refresh or click something to see the friend arrive.
- It works on `localhost` but not between two phones on the deployed site.
- A choice here that would force a rewrite when the battle game is added (e.g. peer-to-peer where one player's browser is the authority).

## 3. Constraints

- **Framework:** Next.js (App Router, TypeScript).
- **Hosting:** Vercel, Hobby (free) plan.
- **Database:** Turso (hosted SQLite) via `@libsql/client`.
- **Data access:** an ORM / query builder, not raw SQL (user's preference). **Drizzle ORM** with its libSQL driver, and `drizzle-kit` for migrations (my call: Turso documents Drizzle as a first-class option, it's lightweight, fully typed, and has no separate engine binary to deploy — unlike Prisma).
- **Realtime:** Ably (free tier, no card required). See [the research notes](../../research/2026-10-16-realtime-options.md) for why not WebRTC or Pusher.
- Everything must fit in free tiers.

## 4. Architecture

```
 Browser (host)            Vercel (Next.js)              Turso
 ───────────────           ───────────────────           ─────
 POST /api/rooms  ───────▶ create room + host player ──▶ rooms, players
 GET  /api/ably-token ───▶ token for channel room:CODE
 subscribe room:CODE ◀───────────────────────────────── Ably

 Browser (friend)
 POST /api/rooms/CODE/join ▶ add player 2 (transaction) ▶ players
                             publish "player-joined" ──▶ Ably ──▶ host's browser
```

- **The server is the only authority.** Browsers never publish to Ably; they only subscribe. All changes go through Next.js Route Handlers, which write to Turso and then publish an event. This is the same pattern the battle game will use (client POSTs a move → server resolves → writes → publishes).
- **Turso is the source of truth.** Ably only carries "something changed" notifications. Any screen can always rebuild itself from a `GET`.
- Ably presence (who's online) is **not** used; the "friend joined" signal comes from the database-backed `player-joined` event. The user has said an online indicator is unnecessary.

## 5. Screens and flow

Three screens (wireframes approved in brainstorming):

1. **Home (`/`)** — both players.
   - "Your name" text field.
   - **Host a room** button.
   - Room code field + **Join room** button.
   - Name is required for either button. Join also requires a code.
2. **Waiting** — host only, shown at `/room/[code]` while the room has one player.
   - Room code in large type, a **Copy code** button, "Send this to a friend. Waiting for someone to join…"
3. **Room** — both players, shown at `/room/[code]` once the room has two players.
   - "Room CODE", host's name (marked "host"), friend's name, "Both players connected."

Host path: Home → Waiting → Room (automatic). Friend path: Home → Room.

Waiting and Room are the same route; the page picks which view to show from the player count.

**Errors shown on Home**
- Wrong / unknown / expired code → "Room not found."
- Room already has two players → "Room is full."
- Missing name or code → inline validation message.

## 6. Data model (Turso)

Shown as SQL for clarity; implement it as a Drizzle schema (`sqliteTable`) that produces these tables and constraints.

```sql
CREATE TABLE rooms (
  code        TEXT PRIMARY KEY,          -- e.g. 'K7PQ'
  created_at  INTEGER NOT NULL,          -- unix ms
  expires_at  INTEGER NOT NULL           -- unix ms
);

CREATE TABLE players (
  id          TEXT PRIMARY KEY,          -- random public id (used as Ably clientId)
  secret      TEXT NOT NULL UNIQUE,      -- random, stored only in the player's cookie
  room_code   TEXT NOT NULL REFERENCES rooms(code),
  name        TEXT NOT NULL,
  slot        INTEGER NOT NULL,          -- 1 = host, 2 = guest
  joined_at   INTEGER NOT NULL,
  UNIQUE (room_code, slot)
);
```

The `UNIQUE (room_code, slot)` constraint is what guarantees a room never gets a third player, even if two people press Join at the same instant.

## 7. Identity and refresh

- No accounts. A "player" is just a throwaway record tied to one room; it disappears with the room. When you host or join, the server creates a `players` row and sets an **httpOnly cookie** containing that player's `secret`.
- A browser holds one active player at a time. Hosting or joining again replaces the cookie. (Confirmed by the user: to test against yourself, use a private window or a second browser.)
- On `/room/[code]`, the page asks the server for the room state. The server looks up the cookie's secret; if it belongs to a player in that room, it returns the state. Otherwise the user is sent to Home with "Room not found."
- This is what makes refresh work: the cookie survives the refresh, so you land back in the same room and the same view.
- If you already belong to a room and enter its code again on Home, you are simply taken back into it rather than counted as a new player.

## 8. Room codes

- 4 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L) — about 920,000 combinations.
- Generated randomly on the server; on a collision with a live room, retry.
- Input is case-insensitive and trimmed; displayed uppercase.

## 9. Expiry (confirmed by the user)

- A room expires **30 minutes** after creation if nobody has joined.
- A room with two players expires **24 hours** after creation.
- Expired rooms behave exactly like nonexistent ones ("Room not found").
- On a successful join, the room's `expires_at` is moved to 24 hours after creation.
- Cleanup is lazy: expired rows are ignored by queries. When creating a room, delete expired rooms (and their players first, because of the foreign key) so a code can be reused. No cron job needed for the PoC.

## 10. Names (confirmed by the user)

- Trimmed, 1–12 characters. Any characters allowed; rendered as plain text (React escapes it).
- Two players may have the same name.

## 11. API

All under `app/api/`, Node runtime.

| Method & path | Body | Does | Returns |
|---|---|---|---|
| `POST /api/rooms` | `{ name }` | Creates room + host player (slot 1), sets cookie | `201 { code }` |
| `POST /api/rooms/[code]/join` | `{ name }` | In a transaction: room exists & not expired, slot 2 free → insert player 2, set cookie, then **await** Ably publish of `player-joined` | `200 { code }` · `404` not found/expired · `409` full |
| `GET /api/rooms/[code]` | — | Requires cookie of a player in this room | `200 { code, you: { id, slot }, players: [{ id, name, slot }] }` · `404` |
| `GET /api/ably-token` | — | Requires cookie; returns an Ably token request with `clientId = player.id` and capability `{ "room:CODE": ["subscribe"] }` for the player's room only | `200 tokenRequest` · `401` |

Notes:
- The Ably publish in `join` must be awaited before the response returns, otherwise Vercel may freeze the function and the event arrives late.
- The capability must always be set explicitly; a token with no capability inherits the full API key's rights.

## 12. Realtime

- One Ably channel per room: `room:CODE`.
- One event for this PoC: **`player-joined`**, payload `{ players: [{ id, name, slot }] }` (the full list, so receiving it twice is harmless).
- Client setup: the Ably client is created only in the browser (inside a `'use client'` provider, in `useEffect`), using `authUrl: '/api/ably-token'`. Use the official `ably` SDK (the `ably/react` hooks or the Realtime client directly — builder's choice).
- **Avoiding a missed event:** on the room page, subscribe to the channel first, then `GET /api/rooms/[code]`. Whichever arrives last wins; both carry the full player list.
- **Re-check after backgrounding (confirmed by the user):** the host typically leaves the browser to paste the code into a messaging app, and phones often drop the Ably connection meanwhile. The room page must also re-run `GET /api/rooms/[code]` whenever the Ably connection returns to `connected` and whenever the tab becomes visible again (`visibilitychange`). Otherwise the host could sit on the waiting screen after the friend joined — an anti-goal.
- **If the Ably publish fails in `join` (confirmed by the user):** the player row is already committed, so `join` still returns `200`; log the error. The host recovers through the re-check above.

## 13. Configuration

Environment variables (set in Vercel and `.env.local`):
- `ABLY_API_KEY`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

**Who sets this up:** the user creates the Ably, Turso, Vercel (and GitHub) accounts and supplies the values. The plan must include clear hand-off points for this, and for the final two-device test.

## 14. How we know it works

1. Deployed to a Vercel URL (not just localhost).
2. Host on one device (e.g. a laptop), friend on another (e.g. a phone on mobile data).
3. Host creates a room; friend joins with the code.
4. The host's screen switches to the Room view within about 2 seconds, with no click or refresh, and both names show on both devices.
5. Refreshing either device returns to the same Room view.
6. A third device using the same code sees "Room is full."
7. A made-up code shows "Room not found."

## 15. Left to the builder

- How Drizzle migrations are run (e.g. `drizzle-kit push` vs. generated migration files) and where the schema file lives.
- Project layout, component structure, and form handling.
- Exact copy and minimal layout, as long as it matches the three wireframes.
- Cookie attributes (expected: `httpOnly`, `Secure` in production, `SameSite=Lax`, ~24 h max-age) and how the "Room not found" message is passed back to Home.
- Test approach and tooling.
- Ably client details beyond what's specified (modular vs. default build, etc.).

## 16. Looking ahead (not in scope)

- Battle game: clients POST moves, server resolves turns with server-side randomness, stores state in Turso, publishes `turn-resolved`. Events will need a version/turn number.
- Pokémon Crystal (Gen 2) visual style.
