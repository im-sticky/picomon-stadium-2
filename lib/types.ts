export type Slot = 1 | 2;

export type PublicPlayer = {
  id: string;
  name: string;
  slot: Slot;
};

export type RoomState = {
  code: string;
  you: { id: string; slot: Slot };
  players: PublicPlayer[];
};
