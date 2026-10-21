import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { pickType } from '@/lib/rooms';
import type { RoomEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';
import { isTypeChoice } from '@/lib/type-battle';

/**
 * Records the player's secret type pick. Only the pick that completes a round is
 * announced, with both picks; the first pick is returned to its picker alone.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const type = body?.type;
  if (!isTypeChoice(type)) return NextResponse.json({ error: 'invalid-type' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await pickType(getDb(), code, readSessionSecret(req), type, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-picking':
      return NextResponse.json({ error: 'Not choosing a type.' }, { status: 409 });
    case 'already-picked':
      return NextResponse.json({ error: 'Already picked.' }, { status: 409 });
    case 'picked': {
      if (!result.resolved) {
        return NextResponse.json({ ok: true, event: { kind: 'own-type-pick', round: result.round, type } });
      }
      const { round, picks, winner } = result;
      const event: RoomEvent = { kind: 'type-round-resolved', round, picks, winner };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
