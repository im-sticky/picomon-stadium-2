import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { setReady } from '@/lib/rooms';
import { lobbyUpdated } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** READY (`ready: true`) or CANCEL READY (`ready: false`) in the waiting room. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const ready = body?.ready;
  if (typeof ready !== 'boolean') return NextResponse.json({ error: 'invalid-ready' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await setReady(getDb(), code, readSessionSecret(req), ready, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-full':
      return NextResponse.json({ error: 'Waiting for an opponent.' }, { status: 409 });
    case 'already-started':
      return NextResponse.json({ error: 'The battle has started.' }, { status: 409 });
    case 'unchanged':
      return NextResponse.json({ ok: true });
    case 'updated': {
      const event = lobbyUpdated(result);
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
