import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { publishPlayerJoined } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { joinRoom } from '@/lib/rooms';
import { readSessionSecret, setSessionCookie } from '@/lib/session';
import { playerFromTrainer } from '@/lib/trainers';

/** Joins a room as `trainer`. Both players may be the same trainer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const player = playerFromTrainer(body?.trainer);
  if (!player) return NextResponse.json({ error: 'invalid-trainer' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await joinRoom(getDb(), code, player.name, Date.now(), readSessionSecret(req), player.trainer);
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'full':
      return NextResponse.json({ error: 'Room is full.' }, { status: 409 });
    case 'already-member':
      return NextResponse.json({ code: result.code }, { status: 200 });
    case 'joined': {
      try {
        await publishPlayerJoined(result.code, result.players);
      } catch (err) {
        console.error('Failed to publish player-joined', err);
      }
      const res = NextResponse.json({ code: result.code }, { status: 200 });
      setSessionCookie(res, result.secret);
      return res;
    }
  }
}
