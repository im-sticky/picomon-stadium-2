import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { submitOrder } from '@/lib/battle';
import { normalizeCode } from '@/lib/codes';
import { readSessionSecret } from '@/lib/session';

/** A whole order of 1–6 distinct draft positions, each 1–6. */
function parseOrder(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return null;
  if (!value.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) return null;
  return new Set(value).size === value.length ? (value as number[]) : null;
}

/**
 * The player's Battle order so far. Each extension is announced as a count only;
 * the order itself stays secret.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const order = parseOrder(body?.order);
  if (!order) return NextResponse.json({ error: 'invalid-order' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await submitOrder(getDb(), code, readSessionSecret(req), order, Date.now());
  if ('events' in result) {
    for (const event of result.events) await notifyRoomEvent(code, event);
  }
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'no-battle':
      return NextResponse.json({ error: 'No battle yet.' }, { status: 409 });
    case 'busy':
      return NextResponse.json({ error: 'Busy, try again.' }, { status: 503 });
    case 'invalid-order':
      return NextResponse.json({ error: 'invalid-order' }, { status: 400 });
    case 'order-conflict':
      return NextResponse.json({ error: 'Order already chosen.', view: result.view }, { status: 409 });
    case 'not-ordering':
      return NextResponse.json({ error: 'Not choosing an order.', view: result.view }, { status: 409 });
    case 'progressed':
    case 'unchanged':
      return NextResponse.json({ ok: true, events: result.events, view: result.view });
  }
}
