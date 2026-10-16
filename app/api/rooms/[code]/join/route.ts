import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { publishPlayerJoined } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { normalizeName } from '@/lib/names';
import { joinRoom } from '@/lib/rooms';
import { readSessionSecret, setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const name = normalizeName(body?.name);
  if (!name) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await joinRoom(getDb(), code, name, Date.now(), readSessionSecret(req));
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
