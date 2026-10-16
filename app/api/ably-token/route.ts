import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createTokenRequestFor } from '@/lib/ably-server';
import { findActivePlayer } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

export async function GET(req: NextRequest) {
  // Read the cookie first: it is the runtime-data access that opts out of prerendering.
  const secret = readSessionSecret(req);
  const player = await findActivePlayer(getDb(), secret, Date.now());
  if (!player) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await createTokenRequestFor(player.id, player.roomCode));
}
