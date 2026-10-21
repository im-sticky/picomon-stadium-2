import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { submitChoice } from '@/lib/battle';
import type { BattleChoice } from '@/lib/battle-types';
import { normalizeCode } from '@/lib/codes';
import { readSessionSecret } from '@/lib/session';

const inRange = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** The choice, built from the known fields only: anything else in the body is ignored. */
function parseChoice(value: unknown): BattleChoice | null {
  const c = value as { kind?: unknown; move?: unknown; slot?: unknown } | null;
  if (c?.kind === 'move' && inRange(c.move, 1, 4)) return { kind: 'move', move: c.move as 1 | 2 | 3 | 4 };
  if (c?.kind === 'switch' && inRange(c.slot, 2, 6)) return { kind: 'switch', slot: c.slot as 2 | 3 | 4 | 5 | 6 };
  return null;
}

/** A move or switch for one step. Only the choice that completes the step is announced. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const step = body?.step;
  const choice = parseChoice(body?.choice);
  if (!Number.isInteger(step) || step < 0 || !choice) {
    return NextResponse.json({ error: 'invalid-choice' }, { status: 400 });
  }

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await submitChoice(getDb(), code, readSessionSecret(req), step, choice, Date.now());
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
    case 'invalid-body':
      return NextResponse.json({ error: 'invalid-choice' }, { status: 400 });
    case 'stale-step':
      return NextResponse.json({ error: 'stale-step', events: result.events, view: result.view }, { status: 409 });
    case 'not-asked':
      return NextResponse.json({ error: result.message, view: result.view }, { status: 409 });
    case 'already-chosen':
      return NextResponse.json({ error: 'Already chosen.', view: result.view }, { status: 409 });
    case 'ended':
      return NextResponse.json({ error: 'The battle is over.', view: result.view }, { status: 409 });
    case 'rejected':
      return NextResponse.json(
        { error: 'invalid-choice', message: result.message, view: result.view },
        { status: 422 },
      );
    case 'chosen':
    case 'resolved':
      return NextResponse.json({ ok: true, events: result.events, view: result.view });
  }
}
