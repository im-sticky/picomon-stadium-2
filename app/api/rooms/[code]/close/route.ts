import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import type { RoomClosedEvent } from '@/lib/room-events';
import { closeRoom } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

/** QUIT: either player closes the room after the battle, and both players go back to Home. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await closeRoom(getDb(), code, readSessionSecret(req), Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-ended':
      return NextResponse.json({ error: 'The battle is not over.' }, { status: 409 });
    case 'closed': {
      const event: RoomClosedEvent = { kind: 'room-closed' };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
