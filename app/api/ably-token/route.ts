import { connection, NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createTokenRequestFor } from '@/lib/ably-server';
import { findActivePlayer } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

export async function GET(req: NextRequest) {
  await connection();
  const secret = readSessionSecret(req);
  const player = await findActivePlayer(getDb(), secret, Date.now());
  if (!player) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await createTokenRequestFor(player.id, player.roomCode));
  } catch (err) {
    console.error('ably-token: token creation failed', err);
    return NextResponse.json({ error: 'Realtime unavailable.' }, { status: 500 });
  }
}
