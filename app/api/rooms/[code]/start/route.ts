import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { startTypeBattle } from '@/lib/rooms';
import type { RoomEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** The host starts the type battle. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await startTypeBattle(getDb(), code, readSessionSecret(req), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-host':
      return NextResponse.json({ error: 'Only the host can start.' }, { status: 403 });
    case 'not-full':
      return NextResponse.json({ error: 'Waiting for an opponent.' }, { status: 409 });
    case 'already-started':
      return NextResponse.json({ ok: true });
    case 'started': {
      const event: RoomEvent = { kind: 'type-battle-started', round: 1 };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
