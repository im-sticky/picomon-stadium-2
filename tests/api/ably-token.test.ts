// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

const createTokenRequest = vi.fn().mockResolvedValue({ keyName: 'k' });
const publish = vi.fn().mockResolvedValue(undefined);
const get = vi.fn(() => ({ publish }));

vi.mock('ably', () => ({
  Rest: class {
    auth = { createTokenRequest };
    channels = { get };
  },
}));

import { channelName, createTokenRequestFor, publishPlayerJoined } from '@/lib/ably-server';

describe('ably-server', () => {
  it('channelName', () => {
    expect(channelName('K7PQ')).toBe('room:K7PQ');
  });

  it('createTokenRequestFor restricts to subscribe on the room channel', async () => {
    process.env.ABLY_API_KEY = 'test.key:secret';
    const out = await createTokenRequestFor('p1', 'K7PQ');
    expect(out).toEqual({ keyName: 'k' });
    const params = createTokenRequest.mock.calls[0][0];
    const capability =
      typeof params.capability === 'string' ? JSON.parse(params.capability) : params.capability;
    expect(params.clientId).toBe('p1');
    expect(capability).toEqual({ 'room:K7PQ': ['subscribe'] });
  });

  it('publishPlayerJoined publishes player-joined', async () => {
    process.env.ABLY_API_KEY = 'test.key:secret';
    const players = [{ id: 'a', name: 'Ash', slot: 1 as const }];
    await publishPlayerJoined('K7PQ', players);
    expect(get).toHaveBeenCalledWith('room:K7PQ');
    expect(publish).toHaveBeenCalledWith('player-joined', { players });
  });
});
