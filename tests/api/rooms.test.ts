// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTests } from '@/db/client';
import { createTestDb } from '@/tests/helpers/test-db';

// connection() only works inside a Next request scope.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ably-server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ably-server')>();
  return {
    ...actual,
    publishPlayerJoined: vi.fn().mockResolvedValue(undefined),
    notifyRoomEvent: vi.fn().mockResolvedValue(undefined),
    createTokenRequestFor: vi.fn().mockResolvedValue({ keyName: 'k' }),
  };
});

import { publishPlayerJoined, notifyRoomEvent, createTokenRequestFor } from '@/lib/ably-server';
import { POST as createRoomRoute } from '@/app/api/rooms/route';
import { POST as joinRoute } from '@/app/api/rooms/[code]/join/route';
import { GET as stateRoute } from '@/app/api/rooms/[code]/route';
import { GET as tokenRoute } from '@/app/api/ably-token/route';
import { POST as startRoute } from '@/app/api/rooms/[code]/start/route';
import { POST as pickRoute } from '@/app/api/rooms/[code]/type-pick/route';
import { POST as againRoute } from '@/app/api/rooms/[code]/again/route';
import { POST as orderRoute } from '@/app/api/rooms/[code]/order/route';
import { POST as draftPickRoute } from '@/app/api/rooms/[code]/draft-pick/route';
import { POKEMON } from '@/data/pokemon';

const CODE_RE = /^[A-HJKMNP-Z2-9]{4}$/;

function req(path: string, method: string, body?: unknown, cookie?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: cookie ? { cookie } : {},
  });
}
const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
function cookieOf(res: Response): string {
  return (res.headers.get('set-cookie') ?? '').split(';')[0];
}

async function host(trainer = 'gold', settings: object = {}) {
  const res = await createRoomRoute(req('/api/rooms', 'POST', { trainer, ...settings }));
  const { code } = await res.json();
  return { code: code as string, cookie: cookieOf(res), res };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(publishPlayerJoined).mockResolvedValue(undefined);
  setDbForTests(await createTestDb());
});

describe('rooms API', () => {
  it('host creates a room', async () => {
    const { code, res } = await host();
    expect(res.status).toBe(201);
    expect(code).toMatch(CODE_RE);
    const sc = res.headers.get('set-cookie') ?? '';
    expect(sc).toContain('picomon_player=');
    expect(sc).toContain('HttpOnly');
  });

  it.each([undefined, '', 'Gold', 'ash', 42])('create with trainer %j is 400', async (trainer) => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { trainer }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-trainer' });
  });

  it("stores each player's trainer and its name, and both players may be the same trainer", async () => {
    const { code, cookie } = await host('lt_surge');
    const joined = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'lt_surge' }), ctx(code));
    expect(joined.status).toBe(200);
    for (const c of [cookie, cookieOf(joined)]) {
      const state = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, c), ctx(code));
      expect((await state.json()).players).toEqual([
        expect.objectContaining({ slot: 1, name: 'Lt Surge', trainer: 'lt_surge' }),
        expect.objectContaining({ slot: 2, name: 'Lt Surge', trainer: 'lt_surge' }),
      ]);
    }
  });

  it.each(['standard', 'unlimited', 'pokeball'])('a %s draft room reports its draft type to both players', async (draftType) => {
    const { code, cookie } = await host('gold', { draftType });
    const joined = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'silver' }), ctx(code));
    for (const c of [cookie, cookieOf(joined)]) {
      const state = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, c), ctx(code));
      expect((await state.json()).draftType).toBe(draftType);
    }
  });

  it('create without a draft type defaults to standard', async () => {
    const { code, cookie } = await host();
    const state = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code));
    expect((await state.json()).draftType).toBe('standard');
  });

  it.each(['Standard', 'poke-ball', null, 1])('create with draft type %j is 400', async (draftType) => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { trainer: 'gold', draftType }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-draft-type' });
  });

  it.each([3, 4, 6])('a %iv%i room reports its size to both players', async (size) => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { trainer: 'gold', battleSize: size }));
    expect(res.status).toBe(201);
    const { code } = await res.json();
    const joined = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'misty' }), ctx(code));
    for (const cookie of [cookieOf(res), cookieOf(joined)]) {
      const state = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code));
      expect((await state.json()).battleSize).toBe(size);
    }
  });

  it('create without a battle size defaults to 6', async () => {
    const { code, cookie } = await host();
    const state = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code));
    expect((await state.json()).battleSize).toBe(6);
  });

  it.each([5, 0, '4', null, 4.5])('create with battle size %j is 400', async (battleSize) => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { trainer: 'gold', battleSize }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-battle-size' });
  });

  it('friend joins with lowercase code', async () => {
    const { code } = await host();
    const res = await joinRoute(
      req(`/api/rooms/${code.toLowerCase()}/join`, 'POST', { trainer: 'misty' }),
      ctx(code.toLowerCase()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code });
    expect(res.headers.get('set-cookie')).toContain('picomon_player=');
    expect(publishPlayerJoined).toHaveBeenCalledTimes(1);
    expect(publishPlayerJoined).toHaveBeenCalledWith(code, [
      expect.objectContaining({ slot: 1, name: 'Gold', trainer: 'gold' }),
      expect.objectContaining({ slot: 2, name: 'Misty', trainer: 'misty' }),
    ]);
  });

  it('third person gets 409 Room is full.', async () => {
    const { code } = await host();
    await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'misty' }), ctx(code));
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'brock' }), ctx(code));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Room is full.' });
  });

  it('unknown code gets 404 Room not found.', async () => {
    const res = await joinRoute(req('/api/rooms/ZZZZ/join', 'POST', { trainer: 'misty' }), ctx('ZZZZ'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Room not found.' });
    const bad = await joinRoute(req('/api/rooms/!!/join', 'POST', { trainer: 'misty' }), ctx('!!'));
    expect(bad.status).toBe(404);
  });

  it.each([undefined, '', 'Misty', 'a'.repeat(11)])('join with trainer %j is 400', async (trainer) => {
    const { code } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer }), ctx(code));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-trainer' });
  });

  it('host re-entering own code gets 200 and no publish', async () => {
    const { code, cookie } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'gold' }, cookie), ctx(code));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(publishPlayerJoined).not.toHaveBeenCalled();
  });

  it('join still returns 200 when publish throws', async () => {
    vi.mocked(publishPlayerJoined).mockRejectedValue(new Error('ably down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { code } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'misty' }), ctx(code));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('GET room state with host cookie returns both players', async () => {
    const { code, cookie } = await host();
    await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { trainer: 'misty' }), ctx(code));
    const res = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(code);
    expect(body.you.slot).toBe(1);
    expect(body.players).toHaveLength(2);
  });

  it('GET without cookie is 404', async () => {
    const { code } = await host();
    const res = await stateRoute(req(`/api/rooms/${code}`, 'GET'), ctx(code));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Room not found.' });
  });

  it('GET with a cookie from another room is 404', async () => {
    const a = await host('gold');
    const b = await host('blue');
    const res = await stateRoute(req(`/api/rooms/${a.code}`, 'GET', undefined, b.cookie), ctx(a.code));
    expect(res.status).toBe(404);
  });

  it('ably-token without cookie is 401', async () => {
    const res = await tokenRoute(req('/api/ably-token', 'GET'));
    expect(res.status).toBe(401);
  });

  it('ably-token with cookie calls createTokenRequestFor(playerId, code)', async () => {
    const { code, cookie } = await host();
    const state = await (await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code))).json();
    const res = await tokenRoute(req('/api/ably-token', 'GET', undefined, cookie));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ keyName: 'k' });
    expect(createTokenRequestFor).toHaveBeenCalledWith(state.you.id, code);
  });

  it('ably-token returns 500 when token creation fails', async () => {
    const { cookie } = await host();
    vi.mocked(createTokenRequestFor).mockRejectedValueOnce(new Error('ably down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await tokenRoute(req('/api/ably-token', 'GET', undefined, cookie));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Realtime unavailable.' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('type battle API', () => {
  async function started() {
    const h = await host('gold');
    const joined = await joinRoute(req(`/api/rooms/${h.code}/join`, 'POST', { trainer: 'misty' }), ctx(h.code));
    const guest = cookieOf(joined);
    const res = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, h.cookie), ctx(h.code));
    expect(res.status).toBe(200);
    vi.mocked(notifyRoomEvent).mockClear();
    return { code: h.code, host: h.cookie, guest };
  }
  const pick = (code: string, cookie: string, type: unknown) =>
    pickRoute(req(`/api/rooms/${code}/type-pick`, 'POST', { type }, cookie), ctx(code));
  const getState = async (code: string, cookie: string) =>
    (await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code))).json();

  it('only the host can start; starting tells both players', async () => {
    const h = await host('gold');
    const joined = await joinRoute(req(`/api/rooms/${h.code}/join`, 'POST', { trainer: 'misty' }), ctx(h.code));
    const guest = cookieOf(joined);
    const asGuest = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, guest), ctx(h.code));
    expect(asGuest.status).toBe(403);
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    const res = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, h.cookie), ctx(h.code));
    expect(res.status).toBe(200);
    const event = { kind: 'type-battle-started', round: 1 };
    expect(notifyRoomEvent).toHaveBeenCalledWith(h.code, event);
    expect(await res.json()).toEqual({ ok: true, event });
    expect((await getState(h.code, guest)).phase).toBe('type-battle');
  });

  it("GET never includes the opponent's pick before both have picked", async () => {
    const { code, host: hostCookie, guest } = await started();
    const first = await pick(code, hostCookie, 'fire');
    expect(first.status).toBe(200);
    // The first pick is not broadcast at all, only returned to its picker.
    expect(notifyRoomEvent).not.toHaveBeenCalled();
    expect(await first.json()).toEqual({ ok: true, event: { kind: 'own-type-pick', round: 1, type: 'fire' } });

    const guestRes = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, guest), ctx(code));
    const raw = await guestRes.text();
    expect(raw).not.toContain('fire');
    expect(JSON.parse(raw).typeBattle).toMatchObject({ yourPick: null, opponentPick: null, winner: null });
    expect((await getState(code, hostCookie)).typeBattle).toMatchObject({ yourPick: 'fire', opponentPick: null });

    const second = await pick(code, guest, 'grass');
    expect(second.status).toBe(200);
    const event = { kind: 'type-round-resolved', round: 1, picks: { 1: 'fire', 2: 'grass' }, winner: 1 };
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
    expect(notifyRoomEvent).toHaveBeenCalledWith(code, event);
    expect(await second.json()).toEqual({ ok: true, event });
    expect((await getState(code, guest)).typeBattle).toMatchObject({
      yourPick: 'grass',
      opponentPick: 'fire',
      winner: 1,
    });
  });

  it('rejects a second pick and an invalid type', async () => {
    const { code, host: hostCookie } = await started();
    expect((await pick(code, hostCookie, 'electric')).status).toBe(400);
    expect((await pick(code, hostCookie, 'water')).status).toBe(200);
    const again = await pick(code, hostCookie, 'fire');
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'Already picked.' });
  });

  it('again after a draw starts round 2 for both players', async () => {
    const { code, host: hostCookie, guest } = await started();
    await pick(code, hostCookie, 'water');
    await pick(code, guest, 'water');
    vi.mocked(notifyRoomEvent).mockClear();

    const res = await againRoute(req(`/api/rooms/${code}/again`, 'POST', { round: 1 }, guest), ctx(code));
    expect(res.status).toBe(200);
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
    expect(notifyRoomEvent).toHaveBeenCalledWith(code, { kind: 'type-round-started', round: 2 });
    expect((await getState(code, hostCookie)).typeBattle).toMatchObject({ round: 2, yourPick: null, opponentPick: null });
  });

  it('only the winner can choose the order, and the choice is broadcast', async () => {
    const { code, host: hostCookie, guest } = await started();
    await pick(code, hostCookie, 'grass');
    await pick(code, guest, 'fire');
    vi.mocked(notifyRoomEvent).mockClear();

    const order = (cookie: string, value: unknown) =>
      orderRoute(req(`/api/rooms/${code}/order`, 'POST', { order: value }, cookie), ctx(code));
    expect((await order(hostCookie, 'first')).status).toBe(403);
    expect((await order(guest, 'last')).status).toBe(400);
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    expect((await order(guest, 'first')).status).toBe(200);
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
    expect(notifyRoomEvent).toHaveBeenCalledWith(code, { kind: 'draft-started', firstDrafter: 2 });
    expect((await getState(code, hostCookie)).draft).toEqual({ firstDrafter: 2, picks: [] });
    expect((await order(guest, 'second')).status).toBe(409);
  });

  it('a draft pick from the player on turn is stored and broadcast', async () => {
    const { code, host: hostCookie, guest } = await started();
    await pick(code, hostCookie, 'grass');
    await pick(code, guest, 'fire');
    await orderRoute(req(`/api/rooms/${code}/order`, 'POST', { order: 'second' }, guest), ctx(code));
    vi.mocked(notifyRoomEvent).mockClear();

    const draftPick = (cookie: string, pokemonId: unknown) =>
      draftPickRoute(req(`/api/rooms/${code}/draft-pick`, 'POST', { pokemonId }, cookie), ctx(code));
    const [first, second] = POKEMON.filter((p) => !p.isMaster).map((p) => p.id);
    expect((await draftPick(guest, first)).status).toBe(403);
    expect((await draftPick(hostCookie, 42)).status).toBe(400);
    expect((await draftPick(hostCookie, 'missingno')).status).toBe(400);
    expect(notifyRoomEvent).not.toHaveBeenCalled();

    const picked = await draftPick(hostCookie, first);
    expect(picked.status).toBe(200);
    const event = { kind: 'draft-picked', pickIndex: 0, slot: 1, pokemonId: first };
    expect(notifyRoomEvent).toHaveBeenCalledTimes(1);
    expect(notifyRoomEvent).toHaveBeenCalledWith(code, event);
    expect(await picked.json()).toEqual({ ok: true, event });
    expect((await draftPick(guest, first)).status).toBe(409);
    expect((await getState(code, guest)).draft).toEqual({ firstDrafter: 1, picks: [{ slot: 1, pokemonId: first }] });
    expect((await draftPick(guest, second)).status).toBe(200);
  });

  it('a Poké Ball draft rejects a forced rent of a Pokémon outside its pool', async () => {
    const h = await host('gold', { draftType: 'pokeball' });
    const joined = await joinRoute(req(`/api/rooms/${h.code}/join`, 'POST', { trainer: 'gold' }), ctx(h.code));
    const guest = cookieOf(joined);
    await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, h.cookie), ctx(h.code));
    await pick(h.code, h.cookie, 'grass');
    await pick(h.code, guest, 'water');
    await orderRoute(req(`/api/rooms/${h.code}/order`, 'POST', { order: 'first' }, h.cookie), ctx(h.code));
    vi.mocked(notifyRoomEvent).mockClear();

    const great = POKEMON.find((p) => p.isGreat && !p.isUltra && !p.isMaster)!.id;
    const pokeBall = POKEMON.find((p) => !p.isGreat && !p.isUltra && !p.isMaster)!.id;
    const draftPick = (pokemonId: string) =>
      draftPickRoute(req(`/api/rooms/${h.code}/draft-pick`, 'POST', { pokemonId }, h.cookie), ctx(h.code));
    const rejected = await draftPick(great);
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual({ error: 'Only Poké Ball POKéMON allowed.' });
    expect(notifyRoomEvent).not.toHaveBeenCalled();
    expect((await draftPick(pokeBall)).status).toBe(200);
  });
});
