import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomUpdated } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { playTypeBattleAgain } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

/** After a draw, starts the next type battle round for both players. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const round = body?.round;
  if (!Number.isInteger(round)) return NextResponse.json({ error: 'invalid-round' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await playTypeBattleAgain(getDb(), code, readSessionSecret(req), round, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-draw':
      return NextResponse.json({ error: 'The round was not a draw.' }, { status: 409 });
    case 'already-new-round':
      return NextResponse.json({ ok: true });
    case 'new-round':
      await notifyRoomUpdated(code);
      return NextResponse.json({ ok: true });
  }
}
