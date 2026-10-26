import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { setRoomOptions } from '@/lib/rooms';
import { lobbyUpdated } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';
import { BATTLE_SIZES, DRAFT_TYPES, type BattleSize, type DraftType } from '@/lib/types';

/** The host changes the battle size and draft type in the waiting room. Clears both players' READY. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const battleSize = body?.battleSize;
  if (!BATTLE_SIZES.includes(battleSize)) {
    return NextResponse.json({ error: 'invalid-battle-size' }, { status: 400 });
  }
  const draftType = body?.draftType;
  if (!DRAFT_TYPES.includes(draftType)) {
    return NextResponse.json({ error: 'invalid-draft-type' }, { status: 400 });
  }

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const options = { battleSize: battleSize as BattleSize, draftType: draftType as DraftType };
  const result = await setRoomOptions(getDb(), code, readSessionSecret(req), options, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'not-host':
      return NextResponse.json({ error: 'Only the host can change the options.' }, { status: 403 });
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
