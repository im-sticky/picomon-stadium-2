import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { notifyRoomEvent } from '@/lib/ably-server';
import { normalizeCode } from '@/lib/codes';
import { pickPokemon } from '@/lib/rooms';
import type { RoomEvent } from '@/lib/room-events';
import { readSessionSecret } from '@/lib/session';

/** Rents a Pokémon for the player whose turn it is in the draft. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const body = await req.json().catch(() => null);
  const pokemonId = body?.pokemonId;
  if (typeof pokemonId !== 'string') return NextResponse.json({ error: 'invalid-pokemon' }, { status: 400 });

  const code = normalizeCode((await params).code);
  if (!code) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });

  const result = await pickPokemon(getDb(), code, readSessionSecret(req), pokemonId, Date.now());
  switch (result.kind) {
    case 'not-found':
      return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
    case 'unknown-pokemon':
      return NextResponse.json({ error: 'invalid-pokemon' }, { status: 400 });
    case 'not-your-turn':
      return NextResponse.json({ error: 'Not your turn.' }, { status: 403 });
    case 'not-drafting':
      return NextResponse.json({ error: 'Not drafting.' }, { status: 409 });
    case 'draft-complete':
      return NextResponse.json({ error: 'The draft is complete.' }, { status: 409 });
    case 'taken':
      return NextResponse.json({ error: 'Already rented.' }, { status: 409 });
    case 'uber-limit':
      return NextResponse.json({ error: 'Only one uber each.' }, { status: 409 });
    case 'strong-limit':
      return NextResponse.json({ error: 'Only one strong Pokémon each.' }, { status: 409 });
    case 'item-limit':
      return NextResponse.json({ error: 'Already have a Pokémon holding that item.' }, { status: 409 });
    case 'picked': {
      const event: RoomEvent = { kind: 'draft-picked', pickIndex: result.pickIndex, slot: result.slot, pokemonId };
      await notifyRoomEvent(code, event);
      return NextResponse.json({ ok: true, event });
    }
  }
}
