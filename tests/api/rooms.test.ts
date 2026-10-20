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
    notifyRoomUpdated: vi.fn().mockResolvedValue(undefined),
    createTokenRequestFor: vi.fn().mockResolvedValue({ keyName: 'k' }),
  };
});

import { publishPlayerJoined, notifyRoomUpdated, createTokenRequestFor } from '@/lib/ably-server';
import { POST as createRoomRoute } from '@/app/api/rooms/route';
import { POST as joinRoute } from '@/app/api/rooms/[code]/join/route';
import { GET as stateRoute } from '@/app/api/rooms/[code]/route';
import { GET as tokenRoute } from '@/app/api/ably-token/route';
import { POST as startRoute } from '@/app/api/rooms/[code]/start/route';
import { POST as pickRoute } from '@/app/api/rooms/[code]/type-pick/route';
import { POST as againRoute } from '@/app/api/rooms/[code]/again/route';
import { POST as orderRoute } from '@/app/api/rooms/[code]/order/route';

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

async function host(name = 'Ash') {
  const res = await createRoomRoute(req('/api/rooms', 'POST', { name }));
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

  it('create with blank name is 400', async () => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { name: '  ' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-name' });
  });

  it('create with an 11-character name is 400', async () => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { name: 'a'.repeat(11) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-name' });
  });

  it('create with a 10-character name is 201', async () => {
    const res = await createRoomRoute(req('/api/rooms', 'POST', { name: 'a'.repeat(10) }));
    expect(res.status).toBe(201);
  });

  it('friend joins with lowercase code', async () => {
    const { code } = await host();
    const res = await joinRoute(
      req(`/api/rooms/${code.toLowerCase()}/join`, 'POST', { name: 'Misty' }),
      ctx(code.toLowerCase()),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code });
    expect(res.headers.get('set-cookie')).toContain('picomon_player=');
    expect(publishPlayerJoined).toHaveBeenCalledTimes(1);
    expect(publishPlayerJoined).toHaveBeenCalledWith(code, [
      expect.objectContaining({ slot: 1, name: 'Ash' }),
      expect.objectContaining({ slot: 2, name: 'Misty' }),
    ]);
  });

  it('third person gets 409 Room is full.', async () => {
    const { code } = await host();
    await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'Misty' }), ctx(code));
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'Brock' }), ctx(code));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Room is full.' });
  });

  it('unknown code gets 404 Room not found.', async () => {
    const res = await joinRoute(req('/api/rooms/ZZZZ/join', 'POST', { name: 'Misty' }), ctx('ZZZZ'));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Room not found.' });
    const bad = await joinRoute(req('/api/rooms/!!/join', 'POST', { name: 'Misty' }), ctx('!!'));
    expect(bad.status).toBe(404);
  });

  it('join with invalid name is 400', async () => {
    const { code } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: '' }), ctx(code));
    expect(res.status).toBe(400);
  });

  it('join with an 11-character name is 400', async () => {
    const { code } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'a'.repeat(11) }), ctx(code));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid-name' });
  });

  it('host re-entering own code gets 200 and no publish', async () => {
    const { code, cookie } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'Ash' }, cookie), ctx(code));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(publishPlayerJoined).not.toHaveBeenCalled();
  });

  it('join still returns 200 when publish throws', async () => {
    vi.mocked(publishPlayerJoined).mockRejectedValue(new Error('ably down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { code } = await host();
    const res = await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'Misty' }), ctx(code));
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('GET room state with host cookie returns both players', async () => {
    const { code, cookie } = await host();
    await joinRoute(req(`/api/rooms/${code}/join`, 'POST', { name: 'Misty' }), ctx(code));
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
    const a = await host('Ash');
    const b = await host('Gary');
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
    const h = await host('Ash');
    const joined = await joinRoute(req(`/api/rooms/${h.code}/join`, 'POST', { name: 'Misty' }), ctx(h.code));
    const guest = cookieOf(joined);
    const res = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, h.cookie), ctx(h.code));
    expect(res.status).toBe(200);
    vi.mocked(notifyRoomUpdated).mockClear();
    return { code: h.code, host: h.cookie, guest };
  }
  const pick = (code: string, cookie: string, type: unknown) =>
    pickRoute(req(`/api/rooms/${code}/type-pick`, 'POST', { type }, cookie), ctx(code));
  const getState = async (code: string, cookie: string) =>
    (await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, cookie), ctx(code))).json();

  it('only the host can start; starting tells both players', async () => {
    const h = await host('Ash');
    const joined = await joinRoute(req(`/api/rooms/${h.code}/join`, 'POST', { name: 'Misty' }), ctx(h.code));
    const guest = cookieOf(joined);
    const asGuest = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, guest), ctx(h.code));
    expect(asGuest.status).toBe(403);
    expect(notifyRoomUpdated).not.toHaveBeenCalled();

    const res = await startRoute(req(`/api/rooms/${h.code}/start`, 'POST', {}, h.cookie), ctx(h.code));
    expect(res.status).toBe(200);
    expect(notifyRoomUpdated).toHaveBeenCalledWith(h.code);
    expect((await getState(h.code, guest)).phase).toBe('type-battle');
  });

  it("GET never includes the opponent's pick before both have picked", async () => {
    const { code, host: hostCookie, guest } = await started();
    expect((await pick(code, hostCookie, 'fire')).status).toBe(200);
    // The first pick is not broadcast at all.
    expect(notifyRoomUpdated).not.toHaveBeenCalled();

    const guestRes = await stateRoute(req(`/api/rooms/${code}`, 'GET', undefined, guest), ctx(code));
    const raw = await guestRes.text();
    expect(raw).not.toContain('fire');
    expect(JSON.parse(raw).typeBattle).toMatchObject({ yourPick: null, opponentPick: null, winner: null });
    expect((await getState(code, hostCookie)).typeBattle).toMatchObject({ yourPick: 'fire', opponentPick: null });

    expect((await pick(code, guest, 'grass')).status).toBe(200);
    expect(notifyRoomUpdated).toHaveBeenCalledTimes(1);
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
    vi.mocked(notifyRoomUpdated).mockClear();

    const res = await againRoute(req(`/api/rooms/${code}/again`, 'POST', { round: 1 }, guest), ctx(code));
    expect(res.status).toBe(200);
    expect(notifyRoomUpdated).toHaveBeenCalledTimes(1);
    expect((await getState(code, hostCookie)).typeBattle).toMatchObject({ round: 2, yourPick: null, opponentPick: null });
  });

  it('only the winner can choose the order, and the choice is broadcast', async () => {
    const { code, host: hostCookie, guest } = await started();
    await pick(code, hostCookie, 'grass');
    await pick(code, guest, 'fire');
    vi.mocked(notifyRoomUpdated).mockClear();

    const order = (cookie: string, value: unknown) =>
      orderRoute(req(`/api/rooms/${code}/order`, 'POST', { order: value }, cookie), ctx(code));
    expect((await order(hostCookie, 'first')).status).toBe(403);
    expect((await order(guest, 'last')).status).toBe(400);
    expect(notifyRoomUpdated).not.toHaveBeenCalled();

    expect((await order(guest, 'first')).status).toBe(200);
    expect(notifyRoomUpdated).toHaveBeenCalledTimes(1);
    expect((await getState(code, hostCookie)).typeBattle).toMatchObject({ winner: 2, firstDrafter: 2 });
    expect((await order(guest, 'second')).status).toBe(409);
  });
});
