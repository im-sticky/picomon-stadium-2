import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { normalizeName } from '@/lib/names';
import { createRoom } from '@/lib/rooms';
import { setSessionCookie } from '@/lib/session';
import { BATTLE_SIZES, DEFAULT_BATTLE_SIZE, type BattleSize } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = normalizeName(body?.name);
  if (!name) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });
  const battleSize = body?.battleSize === undefined ? DEFAULT_BATTLE_SIZE : body.battleSize;
  if (!BATTLE_SIZES.includes(battleSize)) {
    return NextResponse.json({ error: 'invalid-battle-size' }, { status: 400 });
  }

  const { code, secret } = await createRoom(getDb(), name, Date.now(), battleSize as BattleSize);
  const res = NextResponse.json({ code }, { status: 201 });
  setSessionCookie(res, secret);
  return res;
}
