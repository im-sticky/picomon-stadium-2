import * as Ably from 'ably';
import type { PublicPlayer } from '@/lib/types';

let client: Ably.Rest | null = null;

function getClient(): Ably.Rest {
  if (!client) {
    const key = process.env.ABLY_API_KEY;
    if (!key) throw new Error('ABLY_API_KEY is not set');
    client = new Ably.Rest({ key });
  }
  return client;
}

export function channelName(code: string): string {
  return `room:${code}`;
}

export async function publishPlayerJoined(code: string, players: PublicPlayer[]): Promise<void> {
  await getClient().channels.get(channelName(code)).publish('player-joined', { players });
}

/**
 * Tells both players that the room changed. It carries no data, so nothing secret
 * (like a type pick) is broadcast: each client refetches its own view.
 */
export async function publishRoomUpdated(code: string): Promise<void> {
  await getClient().channels.get(channelName(code)).publish('room-updated', {});
}

/** Like publishRoomUpdated, but a failure is only logged: clients also refetch on reconnect. */
export async function notifyRoomUpdated(code: string): Promise<void> {
  try {
    await publishRoomUpdated(code);
  } catch (err) {
    console.error('Failed to publish room-updated', err);
  }
}

export async function createTokenRequestFor(
  playerId: string,
  code: string,
): Promise<Ably.TokenRequest> {
  return getClient().auth.createTokenRequest({
    clientId: playerId,
    capability: { [channelName(code)]: ['subscribe'] },
  });
}
