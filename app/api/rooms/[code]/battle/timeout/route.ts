import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { triggerTimeout } from '@/lib/battle';
import { normalizeCode } from '@/lib/codes';
import { readSessionSecret } from '@/lib/session';

/**
 * A client's countdown for `step` reached zero: apply any due timeouts. Either
 * player may call it; when nothing is due it changes nothing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const step = body?.step;
  if (!Number.isInteger(step) || step < 0) return NextResponse.json({ error: 'invalid-step' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await triggerTimeout(getDb(), code, readSessionSecret(req), step, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'no-battle':
      return NextResponse.json({ error: 'No battle yet.' }, { status: 409 });
    case 'busy':
      return NextResponse.json({ error: 'Busy, try again.' }, { status: 503 });
    case 'checked':
      for (const event of result.events) await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, events: result.events, view: result.view });
  }
}
