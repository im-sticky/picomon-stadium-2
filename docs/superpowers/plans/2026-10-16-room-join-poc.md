# Room Join Proof of Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two people on different devices can meet in a room via a 4-character code and see each other's names live, deployed on Vercel.

**Architecture:** Next.js App Router Route Handlers are the only authority: they write rooms/players to Turso via Drizzle, set an httpOnly cookie identifying the player, and publish a `player-joined` event to Ably. Browsers only subscribe (token scoped to `room:CODE`, subscribe-only) and always rebuild their view from `GET /api/rooms/[code]`, which they re-run on Ably reconnect and when the tab becomes visible.

**Tech Stack:** Next.js (App Router, TypeScript), Drizzle ORM + `@libsql/client` + `drizzle-kit`, Turso, Ably (`ably` SDK), Vitest + React Testing Library (jsdom), Vercel Hobby.

**Spec:** `docs/superpowers/specs/2026-10-16-room-join-poc-design.md` (approved). Research: `docs/research/2026-10-16-realtime-options.md`.

## Global Constraints

- Room code: exactly 4 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; input trimmed and case-insensitive; displayed uppercase.
- Name: trimmed, 1–12 characters, any characters, rendered as plain text; duplicate names allowed.
- Expiry: room `expires_at = created_at + 30 min` on create; on successful join `expires_at = created_at + 24 h`. Expired rooms behave exactly like nonexistent ones.
- Max 2 players per room, enforced by `UNIQUE (room_code, slot)`.
- Ably channel name `room:CODE`; single event `player-joined` with payload `{ players: [{ id, name, slot }] }`.
- Ably token: `clientId = player.id`, capability exactly `{ "room:CODE": ["subscribe"] }`. Never issue a token without an explicit capability.
- Browsers never publish to Ably. Ably publish in `join` is **awaited**; if it throws, log and still return `200`.
- No presence, no accounts, no styling beyond plain wireframe layout.
- Error copy: `Room not found.` and `Room is full.`
- Env vars: `ABLY_API_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Never hardcode keys; `.env.local` is git-ignored.
- All route handlers: `export const runtime = 'nodejs'`.
- One active player per browser: hosting or joining replaces the cookie.

## Review Focus

1. **Two joins at the same instant** → exactly one becomes player 2, the other gets `409 Room is full.` Test in Task 4 (`joinRoom` concurrency test).
2. **Code typed lowercase or with spaces (`" k7pq "`)** → treated as `K7PQ`. Tests in Task 2 (`normalizeCode`) and Task 5 (join route with lowercase code).
3. **Expired room** → join and GET both say not found; the code can be reused by a new room after cleanup. Tests in Task 4.
4. **Host (or friend) re-enters their own room's code on Home** → taken back into the room, not counted as a new player and not told "full". Test in Task 4 (`already-member`) and Task 5.
5. **Friend joins while the host's tab is hidden / Ably disconnected** → host's view updates when the tab becomes visible or Ably reconnects. Tests in Task 6 (`startRoomSync` re-fetch tests).

---

### Task 1: Project scaffold, tooling, git

**Files:**
- Create: Next.js app at repo root (via `create-next-app`), `vitest.config.ts`, `tests/setup.ts`, `.env.example`, `.gitignore` additions
- Keep: existing `docs/`

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom env, `@/` path alias → repo root), `npm run dev`, `npm run build`.

- [ ] **Step 1: Initialise git** — `git init -b main` in `/Users/alex/Documents/Development/picomon-stadium-2`.
- [ ] **Step 2: Scaffold Next.js** — the folder is not empty, so scaffold in a sibling temp dir and move it in:
  ```bash
  cd .. && npx create-next-app@latest picomon-scaffold --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --yes
  rsync -a --exclude .git picomon-scaffold/ picomon-stadium-2/ && rm -rf picomon-scaffold
  ```
  Expected: `package.json`, `app/`, `next.config.*` now in the project root alongside `docs/`.
- [ ] **Step 3: Install deps** — `npm i drizzle-orm @libsql/client ably` and `npm i -D drizzle-kit vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event dotenv`.
- [ ] **Step 4: Configure Vitest** — `vitest.config.ts` with `@vitejs/plugin-react`, `environment: 'jsdom'`, `setupFiles: ['tests/setup.ts']`, alias `@` → project root. `tests/setup.ts` imports `@testing-library/jest-dom/vitest`. Add `"test": "vitest run"` to `package.json`.
- [ ] **Step 5: Ignore files** — append `.env*.local`, `.superpowers/` to `.gitignore`. Create `.env.example` listing the three env vars with empty values.
- [ ] **Step 6: Strip the starter page** — replace `app/page.tsx` with a placeholder `<main>Picomon Stadium</main>` and empty out `app/globals.css` / `page.module.css` styling (plain wireframe look only).
- [ ] **Step 7: Verify** — `npm run build` succeeds; `npm test` runs (no tests yet → "No test files found" is acceptable, exit code may be 1; add `--passWithNoTests` to the test script so it exits 0).
- [ ] **Step 8: Commit** — `git add -A && git commit -m "chore: scaffold Next.js app with Vitest"` (includes `docs/`).

---

### Task 2: Codes and names

**Files:**
- Create: `lib/codes.ts`, `lib/names.ts`, `lib/types.ts`
- Test: `tests/lib/codes.test.ts`, `tests/lib/names.test.ts`

**Interfaces:**
- Produces:
  - `CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'`
  - `generateCode(): string` — 4 chars, uses `crypto.getRandomValues`.
  - `normalizeCode(input: unknown): string | null` — trim, uppercase; `null` unless exactly 4 chars all in alphabet.
  - `normalizeName(input: unknown): string | null` — trim; `null` if not a string or length not in 1–12.
  - `lib/types.ts`: `type Slot = 1 | 2; type PublicPlayer = { id: string; name: string; slot: Slot }; type RoomState = { code: string; you: { id: string; slot: Slot }; players: PublicPlayer[] }`

- [ ] **Step 1: Write failing tests**
  ```ts
  test('generateCode returns 4 chars from the alphabet', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  });
  test('normalizeCode trims and uppercases', () => expect(normalizeCode(' k7pq ')).toBe('K7PQ'));
  test('normalizeCode rejects bad input', () => {
    for (const bad of ['', 'K7P', 'K7PQX', 'K0PQ', 'KIPQ', 'K1PQ', 'KLPQ', 'KOPQ', 42, null]) expect(normalizeCode(bad)).toBeNull();
  });
  test('normalizeName trims and accepts 1–12 chars', () => {
    expect(normalizeName('  Ash  ')).toBe('Ash');
    expect(normalizeName('a'.repeat(12))).toBe('a'.repeat(12));
  });
  test('normalizeName rejects empty, whitespace, >12, non-string', () => {
    for (const bad of ['', '   ', 'a'.repeat(13), undefined, 5]) expect(normalizeName(bad)).toBeNull();
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/lib` → FAIL (modules missing).
- [ ] **Step 3: Implement** the three files per Interfaces.
- [ ] **Step 4: Run** `npx vitest run tests/lib` → PASS.
- [ ] **Step 5: Commit** — `feat: room code and name validation`.

---

### Task 3: Database schema and client (Drizzle)

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `drizzle.config.ts`, `drizzle/` (generated migrations), `tests/helpers/test-db.ts`
- Modify: `package.json` scripts
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces:
  - `db/schema.ts`: `rooms` (`code` text PK, `createdAt` int, `expiresAt` int) and `players` (`id` text PK, `secret` text not null unique, `roomCode` text not null references `rooms.code`, `name` text not null, `slot` int not null, `joinedAt` int not null, `unique(roomCode, slot)`), column names in snake_case as in the spec.
  - `db/client.ts`: `type Db = LibSQLDatabase<typeof schema>`; `getDb(): Db` (lazy singleton from `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`); `setDbForTests(db: Db | null): void`.
  - `tests/helpers/test-db.ts`: `createTestDb(): Promise<Db>` — `createClient({ url: ':memory:' })`, `drizzle(client, { schema })`, then `migrate(db, { migrationsFolder: 'drizzle' })`.
  - Scripts: `"db:generate": "drizzle-kit generate"`, `"db:migrate": "drizzle-kit migrate"`.

- [ ] **Step 1: Write failing test** `tests/db/schema.test.ts`:
  ```ts
  test('rejects a second player in the same slot', async () => {
    const db = await createTestDb();
    await db.insert(rooms).values({ code: 'K7PQ', createdAt: 0, expiresAt: 1 });
    await db.insert(players).values({ id: 'a', secret: 'sa', roomCode: 'K7PQ', name: 'A', slot: 2, joinedAt: 0 });
    await expect(db.insert(players).values({ id: 'b', secret: 'sb', roomCode: 'K7PQ', name: 'B', slot: 2, joinedAt: 0 })).rejects.toThrow();
  });
  ```
- [ ] **Step 2: Run** `npx vitest run tests/db` → FAIL.
- [ ] **Step 3: Implement** schema, `drizzle.config.ts` (`dialect: 'turso'`, `schema: './db/schema.ts'`, `out: './drizzle'`, credentials from env loaded with `dotenv` from `.env.local`), `db/client.ts`, test helper. Run `npm run db:generate` to create the first migration in `drizzle/`.
- [ ] **Step 4: Run** `npx vitest run tests/db` → PASS.
- [ ] **Step 5: Commit** — `feat: drizzle schema for rooms and players` (include `drizzle/`).

---

### Task 4: Room logic

**Files:**
- Create: `lib/rooms.ts`
- Test: `tests/lib/rooms.test.ts`

**Interfaces:**
- Consumes: `Db`, `rooms`, `players` (Task 3); `generateCode` (Task 2); `PublicPlayer`, `RoomState` (Task 2).
- Produces:
  - `WAITING_TTL_MS = 30 * 60 * 1000`, `FULL_TTL_MS = 24 * 60 * 60 * 1000`
  - `createRoom(db: Db, name: string, now: number): Promise<{ code: string; secret: string; playerId: string }>` — deletes expired rooms (players first), generates a code not used by a live room (retry on collision), inserts room + slot-1 player. Ids/secrets via `crypto.randomUUID()`.
  - `type JoinResult = { kind: 'joined'; code: string; secret: string; players: PublicPlayer[] } | { kind: 'already-member'; code: string } | { kind: 'not-found' } | { kind: 'full' }`
  - `joinRoom(db: Db, code: string, name: string, now: number, existingSecret: string | null): Promise<JoinResult>` — in one write transaction: room missing or `expiresAt <= now` → `not-found`; `existingSecret` belongs to a player in this room → `already-member`; insert slot-2 player and set `expiresAt = createdAt + FULL_TTL_MS`; a unique-constraint error (check `err` and `err.cause` for a code starting `SQLITE_CONSTRAINT`) → `full`.
  - `getRoomState(db: Db, code: string, secret: string | null, now: number): Promise<RoomState | null>` — null unless the room is live and `secret` belongs to one of its players; players ordered by slot.
  - `findActivePlayer(db: Db, secret: string | null, now: number): Promise<{ id: string; roomCode: string } | null>` — the player for this secret if their room is live.
  - `code` arguments are already normalized by callers.

- [ ] **Step 1: Write failing tests** (each uses a fresh `createTestDb()`, `T0 = 1_000_000`):
  - `createRoom returns a valid code and the host can read the room` → `getRoomState(db, code, secret, T0)` equals `{ code, you: { id: playerId, slot: 1 }, players: [{ id: playerId, name: 'Ash', slot: 1 }] }`.
  - `joinRoom adds player 2 and returns both players` → `kind: 'joined'`, `players` names `['Ash', 'Misty']`, slots `[1, 2]`.
  - `joinRoom on a full room returns full` → third join `kind: 'full'`.
  - `two simultaneous joins: exactly one joins` → `Promise.all([joinRoom(..., 'B', ...), joinRoom(..., 'C', ...)])` kinds sorted equal `['full', 'joined']`.
  - `joinRoom with unknown code returns not-found`.
  - `waiting room expires after 30 min` → join at `T0 + WAITING_TTL_MS` → `not-found`; `getRoomState` at that time → `null`.
  - `full room lives 24 h from creation` → after join, `getRoomState` at `T0 + WAITING_TTL_MS + 1` is non-null and at `T0 + FULL_TTL_MS` is `null`.
  - `existing member re-entering the code is already-member` → join with host's secret returns `{ kind: 'already-member', code }` and the room still has 1 player.
  - `getRoomState returns null for a secret from another room`.
  - `expired rooms are cleaned up on createRoom` → create room at T0, `createRoom` again at `T0 + FULL_TTL_MS`, then count rows in `rooms` = 1 and the old room's players are gone.
- [ ] **Step 2: Run** `npx vitest run tests/lib/rooms.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/rooms.ts` per Interfaces using Drizzle query builder (`db.transaction(async tx => …, { behavior: 'immediate' })` for join if supported by the libSQL driver; otherwise rely on the unique constraint).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: room create/join/state logic`.

---

### Task 5: Session cookie, Ably server helpers, API routes

**Files:**
- Create: `lib/session.ts`, `lib/ably-server.ts`, `app/api/rooms/route.ts`, `app/api/rooms/[code]/join/route.ts`, `app/api/rooms/[code]/route.ts`, `app/api/ably-token/route.ts`
- Test: `tests/api/rooms.test.ts`, `tests/api/ably-token.test.ts` (both with `// @vitest-environment node`)

**Interfaces:**
- Consumes: Task 2 normalizers, Task 3 `getDb`/`setDbForTests`, Task 4 room functions.
- Produces:
  - `lib/session.ts`: `SESSION_COOKIE = 'picomon_player'`; `readSessionSecret(req: NextRequest): string | null`; `setSessionCookie(res: NextResponse, secret: string): void` (httpOnly, `secure` when `NODE_ENV === 'production'`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 86400`).
  - `lib/ably-server.ts`: `channelName(code: string): string` → `` `room:${code}` ``; `publishPlayerJoined(code: string, players: PublicPlayer[]): Promise<void>` (Ably REST, event `player-joined`, data `{ players }`); `createTokenRequestFor(playerId: string, code: string): Promise<Ably.TokenRequest>` with `{ clientId: playerId, capability: { [channelName(code)]: ['subscribe'] } }`. Ably REST client built lazily from `ABLY_API_KEY`.
  - Routes (all `runtime = 'nodejs'`, params as `{ params: Promise<{ code: string }> }`):
    - `POST /api/rooms` body `{ name }` → invalid name `400 { error: 'invalid-name' }`; else `201 { code }` + cookie.
    - `POST /api/rooms/[code]/join` body `{ name }` → invalid name `400`; invalid code or `not-found` → `404 { error: 'Room not found.' }`; `full` → `409 { error: 'Room is full.' }`; `already-member` → `200 { code }` (no new cookie, no publish); `joined` → set cookie, `await publishPlayerJoined` inside try/catch (`console.error` on failure), `200 { code }`.
    - `GET /api/rooms/[code]` → `getRoomState` → `200 RoomState` or `404 { error: 'Room not found.' }`.
    - `GET /api/ably-token` → `findActivePlayer`; none → `401`; else `200` token request.

- [ ] **Step 1: Write failing tests.** `vi.mock('@/lib/ably-server', …)` keeping real `channelName`, mocking `publishPlayerJoined` and `createTokenRequestFor`; `beforeEach` → `setDbForTests(await createTestDb())`. Build requests with `new NextRequest('http://localhost/api/…', { method, body: JSON.stringify(...), headers: { cookie } })`; read the `Set-Cookie` header to carry the cookie between calls.
  - `host creates a room` → 201, body `code` matches the code regex, `set-cookie` contains `picomon_player=` and `HttpOnly`.
  - `create with blank name is 400`.
  - `friend joins with lowercase code` → 200 and `publishPlayerJoined` called once with `(code, [{…slot:1, name:'Ash'}, {…slot:2, name:'Misty'}])`.
  - `third person gets 409 Room is full.`
  - `unknown code gets 404 Room not found.`
  - `host re-entering own code gets 200 and no publish`.
  - `join still returns 200 when publish throws` (mock rejects).
  - `GET room state with host cookie returns both players`; `GET without cookie is 404`; `GET with a cookie from another room is 404`.
  - `ably-token without cookie is 401`; `ably-token with cookie calls createTokenRequestFor(playerId, code)`.
  - In `tests/api/ably-token.test.ts`, also unit-test the real `createTokenRequestFor` by `vi.mock('ably')` and asserting the `Rest#auth.createTokenRequest` call receives `{ clientId: 'p1', capability: { 'room:K7PQ': ['subscribe'] } }` (capability may be passed as object or JSON string — assert parsed value).
- [ ] **Step 2: Run** `npx vitest run tests/api` → FAIL.
- [ ] **Step 3: Implement** the files per Interfaces.
- [ ] **Step 4: Run** `npx vitest run` → all PASS.
- [ ] **Step 5: Commit** — `feat: room API routes and Ably server helpers`.

---

### Task 6: Client room sync logic

**Files:**
- Create: `lib/room-sync.ts`
- Test: `tests/lib/room-sync.test.ts`

**Interfaces:**
- Consumes: `PublicPlayer`, `RoomState`.
- Produces:
  ```ts
  type RoomSyncDeps = {
    subscribe(onPlayers: (players: PublicPlayer[]) => void): () => void; // Ably 'player-joined'
    onReconnect(cb: () => void): () => void;  // Ably connection → 'connected' (after the first time)
    onVisible(cb: () => void): () => void;    // document visibilitychange → visible
    fetchState(): Promise<RoomState | null>;  // GET /api/rooms/[code]; null on 404
    onState(state: RoomState): void;
    onPlayers(players: PublicPlayer[]): void;
    onGone(): void;                           // room not found → go Home
  };
  startRoomSync(deps: RoomSyncDeps): () => void // returns stop()
  ```
  Order: `subscribe` first, then `fetchState`. Re-run `fetchState` on every reconnect/visible. After `stop()`, no callbacks fire (ignore late fetch results).

- [ ] **Step 1: Write failing tests** with hand-written fakes that capture the registered callbacks:
  - `subscribes before the first fetch` (record call order: `['subscribe', 'fetch']`).
  - `initial fetch result goes to onState`.
  - `player-joined event goes to onPlayers`.
  - `refetches when the tab becomes visible` → fire visible cb; `fetchState` called twice; second result passed to `onState` (a state with 2 players).
  - `refetches on Ably reconnect`.
  - `fetch returning null calls onGone`.
  - `stop() unsubscribes everything and ignores a pending fetch` → all three unsubscribe fns called; resolving the pending fetch afterwards does not call `onState`.
- [ ] **Step 2: Run** `npx vitest run tests/lib/room-sync.test.ts` → FAIL.
- [ ] **Step 3: Implement** `startRoomSync`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: room sync with refetch on reconnect and visibility`.

---

### Task 7: Screens (Home, Waiting, Room)

**Files:**
- Create: `app/home-form.tsx` (client), `app/room/[code]/page.tsx`, `app/room/[code]/room-view.tsx` (client), `app/room/[code]/room-screen.tsx`
- Modify: `app/page.tsx`
- Test: `tests/ui/home-form.test.tsx`, `tests/ui/room-screen.test.tsx`

**Interfaces:**
- Consumes: `normalizeName`, `normalizeCode`, API routes (Task 5), `startRoomSync` (Task 6), `channelName` is server-only — on the client build the channel name inline as `` `room:${code}` ``.
- Produces:
  - `app/page.tsx` (server): reads `searchParams.error`; passes `initialError = 'Room not found.'` when `error === 'not-found'` to `<HomeForm initialError?: string />`.
  - `HomeForm`: "Your name" input, **Host a room** button, "Room code" input, **Join room** button. Validates with the normalizers before calling the API (messages: `Enter a name (1–12 characters).`, `Enter a 4-character room code.`). On success `router.push('/room/' + code)`. On 404/409 shows the API's `error` text.
  - `RoomScreen({ state }: { state: RoomState })` (pure): 1 player and `you.slot === 1` → Waiting view (label "Your room code", code, **Copy code** button using `navigator.clipboard.writeText(code)`, text `Send this to a friend. Waiting for someone to join…`); 2 players → Room view (`Room CODE`, host name with ` (host)`, guest name, `Both players connected.`).
  - `RoomView({ code })` (client): in `useEffect`, create `new Ably.Realtime({ authUrl: '/api/ably-token' })`, wire `startRoomSync` (subscribe to `player-joined` on `room:${code}`; onReconnect via `connection.on('connected')` skipping the first; onVisible via `document.visibilitychange`; `fetchState` via `fetch('/api/rooms/' + code)`); `onPlayers` merges into existing state; `onGone` → `router.replace('/?error=not-found')`. Cleanup: stop sync, `realtime.close()`. Shows `Loading…` until the first state.
  - `app/room/[code]/page.tsx`: normalizes the param; invalid → `redirect('/?error=not-found')`; else renders `<RoomView code={code} />`.

- [ ] **Step 1: Write failing tests**
  - `home-form`: `shows name error when hosting with blank name` (no fetch); `shows code error when joining without a code`; `shows "Room is full." from a 409` (mock `fetch` → 409 `{ error: 'Room is full.' }`); `navigates to /room/K7PQ after hosting` (mock `next/navigation` `useRouter`); `renders initialError`.
  - `room-screen`: `host alone sees waiting view with code K7PQ and Copy code button`; `two players: both names shown, host marked "(host)", "Both players connected."`; `names render as text` (name `<b>x</b>` appears literally).
- [ ] **Step 2: Run** `npx vitest run tests/ui` → FAIL.
- [ ] **Step 3: Implement** the files per Interfaces. Plain markup only, no styling beyond simple stacking.
- [ ] **Step 4: Run** `npx vitest run` → all PASS; `npm run build` succeeds.
- [ ] **Step 5: Commit** — `feat: home, waiting and room screens`.

---

### Task 8: Hand-off — accounts and local end-to-end check (user + agent)

**Files:**
- Create: `README.md` (setup + env + scripts)

- [ ] **Step 1: Write `README.md`** — what the app is, the three env vars, `npm run db:migrate`, `npm run dev`, `npm test`, and how to test alone (normal window + private window).
- [ ] **Step 2: HAND-OFF TO USER — create accounts and fill `.env.local`.** Ask the user to:
  1. Ably: sign up (free, no card) → create an app → copy the **root API key** → `ABLY_API_KEY`.
  2. Turso: sign up → create a database → copy its URL (`libsql://…`) → `TURSO_DATABASE_URL`; create a database token → `TURSO_AUTH_TOKEN`.
  3. Paste all three into `.env.local` at the project root themselves (copy from `.env.example`). **The user should not paste keys into chat.**
  Wait for the user to confirm.
- [ ] **Step 3: Migrate** — `npm run db:migrate` → expected: migration applied, no errors.
- [ ] **Step 4: Local two-browser check** — `npm run dev`; in the built-in browser host as "Ash" in one tab-context and join as "Misty" from a separate private/incognito context (or ask the user to do it in two browsers). Expected: host's waiting screen flips to the Room view without refresh; refresh keeps both in the room; a made-up code shows `Room not found.`
- [ ] **Step 5: Commit** — `docs: README with setup steps`.

---

### Task 9: Hand-off — deploy to Vercel and two-device test (user + agent)

- [ ] **Step 1: HAND-OFF TO USER — GitHub + Vercel.** Ask the user to create an empty GitHub repo and give its URL; then `git remote add origin <url> && git push -u origin main` (with the user's go-ahead). Ask the user to import the repo in Vercel (Hobby), and add the three env vars in Project → Settings → Environment Variables (Production + Preview), then deploy.
- [ ] **Step 2: Verify the deploy** — open the Vercel URL in the built-in browser: Home renders, hosting a room shows a code.
- [ ] **Step 3: HAND-OFF TO USER — the spec's acceptance test** (spec §14): laptop hosts, phone on mobile data joins. Expected:
  1. Host flips to Room within ~2 s, no click/refresh; both names on both devices.
  2. Refreshing either device returns to the Room view.
  3. Host switches to a messaging app, friend joins meanwhile, host returns → Room view appears.
  4. A third device/private window with the same code sees `Room is full.`
  5. A made-up code shows `Room not found.`
- [ ] **Step 4: Record the result** — note pass/fail per item in `docs/superpowers/specs/2026-10-16-room-join-poc-design.md` under a new "Verification" heading; commit `docs: record PoC verification`.
