import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { normalizeName } from '@/lib/names';
import { createRoom } from '@/lib/rooms';
import { setSessionCookie } from '@/lib/session';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = normalizeName(body?.name);
  if (!name) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });

  const { code, secret } = await createRoom(getDb(), name, Date.now());
  const res = NextResponse.json({ code }, { status: 201 });
  setSessionCookie(res, secret);
  return res;
}
