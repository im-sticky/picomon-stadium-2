import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { createRoom } from '@/lib/rooms';
import { setSessionCookie } from '@/lib/session';
import { playerFromTrainer } from '@/lib/trainers';
import {
  BATTLE_SIZES,
  DEFAULT_BATTLE_SIZE,
  DEFAULT_DRAFT_TYPE,
  DRAFT_TYPES,
  type BattleSize,
  type DraftType,
} from '@/lib/types';

/**
 * Hosts a room as `trainer`. Home sends only the trainer, so the room opens at 6V6 and
 * Standard Draft, and the host changes them in the waiting room (`…/options`). An
 * optional `battleSize` and `draftType` are still accepted.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const player = playerFromTrainer(body?.trainer);
  if (!player) return NextResponse.json({ error: 'invalid-trainer' }, { status: 400 });
  const battleSize = body?.battleSize === undefined ? DEFAULT_BATTLE_SIZE : body.battleSize;
  if (!BATTLE_SIZES.includes(battleSize)) {
    return NextResponse.json({ error: 'invalid-battle-size' }, { status: 400 });
  }
  const draftType = body?.draftType === undefined ? DEFAULT_DRAFT_TYPE : body.draftType;
  if (!DRAFT_TYPES.includes(draftType)) {
    return NextResponse.json({ error: 'invalid-draft-type' }, { status: 400 });
  }

  const { code, secret } = await createRoom(getDb(), player.name, Date.now(), battleSize as BattleSize, {
    draftType: draftType as DraftType,
    trainer: player.trainer,
  });
  const res = NextResponse.json({ code }, { status: 201 });
  setSessionCookie(res, secret);
  return res;
}
