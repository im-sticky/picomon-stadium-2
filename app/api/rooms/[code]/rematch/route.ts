import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import type { BattleEvent } from '@/lib/battle-types';
import { normalizeCode } from '@/lib/codes';
import type { RoomClosedEvent, RoomEvent } from '@/lib/room-events';
import { requestRematch } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

/**
 * REMATCH after the battle. The first ask is shown to the other player; the second
 * starts a new game at the type battle, keeping the battle size and draft type.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await requestRematch(getDb(), code, readSessionSecret(req), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-ended':
      return NextResponse.json({ error: 'The battle is not over.' }, { status: 409 });
    case 'closed': {
      const event: RoomClosedEvent = { kind: 'room-closed' };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ error: 'Room closed.' }, { status: 404 });
    }
    case 'already-requested':
      return NextResponse.json({ ok: true });
    case 'requested': {
      const event: BattleEvent = { kind: 'rematch-requested', slot: result.slot };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
    case 'restarted': {
      const event: RoomEvent = { kind: 'rematch-started', game: result.game };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
