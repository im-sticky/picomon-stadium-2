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
    createTokenRequestFor: vi.fn().mockResolvedValue({ keyName: 'k' }),
  };
});

import { publishPlayerJoined, createTokenRequestFor } from '@/lib/ably-server';
import { POST as createRoomRoute } from '@/app/api/rooms/route';
import { POST as joinRoute } from '@/app/api/rooms/[code]/join/route';
import { GET as stateRoute } from '@/app/api/rooms/[code]/route';
import { GET as tokenRoute } from '@/app/api/ably-token/route';

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
