import * as Ably from 'ably';
import type { RoomEvent } from '@/lib/room-events';
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
 * Tells both players what changed, after the write has committed. Only shared
 * results are sent: a type pick stays secret until the round is resolved.
 * A failure is only logged: clients also check the server in the background.
 */
export async function notifyRoomEvent(code: string, event: RoomEvent): Promise<void> {
  try {
    await getClient().channels.get(channelName(code)).publish(event.kind, event);
  } catch (err) {
    console.error(`Failed to publish ${event.kind}`, err);
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
