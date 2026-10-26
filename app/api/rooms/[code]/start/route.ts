import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { startTypeBattle } from '@/lib/rooms';
import type { RoomEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** Either player's client starts the type battle once both are READY and the countdown is over. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await startTypeBattle(getDb(), code, readSessionSecret(req), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-full':
      return NextResponse.json({ error: 'Waiting for an opponent.' }, { status: 409 });
    case 'not-ready':
      return NextResponse.json({ error: 'Not everyone is ready.' }, { status: 409 });
    case 'too-early':
      return NextResponse.json({ error: 'Too early.', startAt: result.startAt }, { status: 409 });
    case 'already-started':
      return NextResponse.json({ ok: true });
    case 'started': {
      const { battleSize, draftType } = result;
      const event: RoomEvent = { kind: 'type-battle-started', round: 1, battleSize, draftType };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
