# Realtime Options for a Two-Player Next.js Game on Vercel

*Research date: 2026-10-16. Compiled from three research agents and a follow-up debate.*

## Decision

**Use Ably** for realtime. Next.js Route Handlers on Vercel are the authority; Turso is the source of truth; Ably only delivers "something changed" events to browsers.

## 1. Why not WebRTC (peer-to-peer)

- **Still needs a server.** Browsers can't find each other on their own; they must exchange connection details through a signaling server — which is exactly the room-code/join flow we're building anyway.
- **Fails for some players.** Estimates (vendor sources, not a primary study) put 10–25% of connections behind NAT setups that need a TURN relay server (free options: Cloudflare Realtime TURN 1,000 GB free; Metered Open Relay 20 GB/mo).
- **No neutral referee.** One player's browser would run the battle and could cheat; randomness and hidden info are visible to that player.
- **Refresh drops the connection**, requiring re-signaling and state resync from somewhere.
- **No benefit for turn-based play.** Latency gains don't matter here.
- Libraries: PeerJS (public server is donation-funded, no SLA), simple-peer (inactive), Trystero (active, signals over public networks).

Sources: getstream.io/resources/projects/webrtc/advanced/stun-turn/, developers.cloudflare.com/realtime/pricing/, peerjs.com/server/cloud, github.com/dmotz/trystero

## 2. Vercel constraints

- Native WebSocket support entered **public beta on 2026-06-22**, but connections close at the function's max duration (300 s on Hobby), are pinned to one instance (needs Redis to share state), and lack documented Next.js App Router examples. Not recommended yet.
- Vercel's own realtime guide recommends publishing from a function and letting clients subscribe through a hosted provider (Ably, Pusher, Liveblocks, PartyKit, Supabase, etc.).

Sources: vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections, vercel.com/guides/publish-and-subscribe-to-realtime-data-on-vercel

## 3. Hosted options considered

| Option | Free tier | Presence | Fit |
|---|---|---|---|
| **Ably** | 200 connections, 6M msgs/mo, **no card (stated)** | Yes | Excellent |
| **Pusher Channels** | 100 connections, 200k msgs/day, no card (inferred: sign-up has no payment fields; card collected only on upgrade) | Yes | Excellent for PoC |
| Supabase Realtime | 200 connections | Yes | Good, but adds a second DB vendor |
| Liveblocks | 500 rooms/mo | Yes | Overkill (built for collaborative docs) |
| PartyKit / Cloudflare Durable Objects | Workers free tier | DIY | Strong for authoritative game rooms; separate deploy. Possible later upgrade. |
| Polling Turso every 1–2 s | Turso free | Implicit | Simplest fallback; slightly laggy |

## 4. Ably vs Pusher (head-to-head)

Two agents researched one service each, read each other's findings, and argued it out. **Both ended up picking Ably**, including the agent assigned to Pusher. Final scores: Ably 8/10, Pusher 7/10 (Pusher still ~8/10 for a throwaway PoC alone).

**Points agreed by both**
- Message history/recovery doesn't decide it: Turso is the source of truth, so clients refetch state on load/reconnect with either service.
- Room security is equivalent: both rely on our auth route to allow only the room's members; Pusher clients can't publish by default, Ably uses capability-scoped tokens.
- Free-tier limits are far beyond what 2-player rooms need with either.

**Why Ably won**
- **Product health (deciding factor).** ably-js ships roughly monthly (v2.25–v2.29, Jul–Sep 2026). Pusher looks to be in maintenance mode under Bird: 2026 releases are mostly dependency/security fixes, support docs moved to bird.com with broken links, and Vercel's official Pusher guide now redirects elsewhere. This project is expected to grow into a game.
- Explicit "no credit card" statement.
- Official React hooks (`ably/react`).
- Shorter, tunable disconnect detection: realistic worst case ~30–45 s vs Pusher's ~75 s — matters later for "opponent disconnected."
- 200 vs 100 concurrent connections.

**Where Pusher was better**
- Smaller client: ~18 KB gzipped vs Ably's ~82 KB (default) / ~28 KB (modular build).
- Simpler: fewer concepts; auth route ~20 lines.

**Ably gotchas to remember**
- Always set an explicit token capability (otherwise the token inherits the API key's full rights).
- Create the Ably client only in the browser (`useEffect` in a `'use client'` provider); its Next.js guide hardcodes an API key — don't copy that.
- Await REST publishes from Route Handlers.
- Don't use presence as the source of truth for "player joined"; refreshes show as leave + re-enter.

Sources: ably.com/docs/platform/pricing/free, ably.com/docs/auth/capabilities, ably.com/docs/presence-occupancy/presence, ably.com/docs/getting-started/nextjs, github.com/ably/ably-js/releases, pusher.com/channels/pricing, pusher.com/docs/channels/using_channels/presence-channels/, pusher.com/blog/lower-delays-in-presence-channel-disconnection-timeouts, github.com/pusher/pusher-js/releases

## 5. Unverified

- Turso's exact free storage (reported as both 5 GB and 500 MB).
- Exact share of WebRTC sessions needing TURN.
- Whether Ably suspends idle free accounts.
- Pusher's "no card" is inferred, not stated by Pusher.
