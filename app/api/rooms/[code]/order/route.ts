import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { chooseDraftOrder } from '@/lib/rooms';
import type { RoomEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** The type battle winner chooses to draft FIRST or SECOND. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const order = body?.order;
  if (order !== 'first' && order !== 'second') {
    return NextResponse.json({ error: 'invalid-order' }, { status: 400 });
  }

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await chooseDraftOrder(getDb(), code, readSessionSecret(req), order, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-winner':
      return NextResponse.json({ error: 'Only the winner chooses the order.' }, { status: 403 });
    case 'not-decided':
      return NextResponse.json({ error: 'No winner yet.' }, { status: 409 });
    case 'already-chosen':
      return NextResponse.json({ error: 'The order is already chosen.' }, { status: 409 });
    case 'chosen': {
      const event: RoomEvent = { kind: 'draft-started', firstDrafter: result.firstDrafter };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
