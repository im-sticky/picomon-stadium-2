import { connection, NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { getBattleView, startBattle } from '@/lib/battle';
import { normalizeCode } from '@/lib/codes';
import type { RoomClosedEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** START BATTLE: the host moves a finished draft to the Battle order screen. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await startBattle(getDb(), code, readSessionSecret(req), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-host':
      return NextResponse.json({ error: 'Only the host can start.' }, { status: 403 });
    case 'not-drafting':
      return NextResponse.json({ error: 'Not drafting.' }, { status: 409 });
    case 'draft-incomplete':
      return NextResponse.json({ error: 'The draft is not complete.' }, { status: 409 });
    case 'already-started':
      return NextResponse.json({ ok: true });
    case 'started':
      await notifyRoomEvent(code, result.event);
      return NextResponse.json({ ok: true, event: result.event });
  }
}

/** The player's view of the battle, from step `?from=` on. Applies any due timeouts first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  await connection();
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  const fromText = req.nextUrl.searchParams.get('from') ?? '0';
  if (!/^\d+$/.test(fromText)) return NextResponse.json({ error: 'invalid-from' }, { status: 400 });

  const result = await getBattleView(getDb(), code, readSessionSecret(req), Number(fromText), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'no-battle':
      return NextResponse.json({ error: 'No battle yet.' }, { status: 409 });
    case 'busy':
      return NextResponse.json({ error: 'Busy, try again.' }, { status: 503 });
    case 'closed': {
      // The end screen's time ran out: the room is closed, and both players go Home.
      const event: RoomClosedEvent = { kind: 'room-closed' };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ error: 'Room closed.' }, { status: 404 });
    }
    case 'view':
      for (const event of result.events) await notifyRoomEvent(code, event);
      return NextResponse.json(result.view);
  }
}
