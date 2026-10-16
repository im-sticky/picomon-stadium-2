import { connection, NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { normalizeCode } from '@/lib/codes';
import { getRoomState } from '@/lib/rooms';
import { readSessionSecret } from '@/lib/session';

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  await connection();
  const secret = readSessionSecret(req);
  const code = normalizeCode((await params).code);
  const state = code ? await getRoomState(getDb(), code, secret, Date.now()) : null;
  if (!state) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  return NextResponse.json(state);
}
