import { normalizeName } from "@/lib/names";

/**
 * The trainers a player can be: the sprites in `public/sprites/trainers/`, keyed by
 * file name. Order (as on Choose a Trainer): Gold, Kris, Silver; the Johto gym
 * leaders; the Johto Elite Four and Lance; the Kanto gym leaders (as in Gold/Silver);
 * Red; the rest of Kanto's Elite Four; Giovanni.
 */
export const TRAINERS = [
  "gold",
  "kris",
  "silver",
  "falkner",
  "bugsy",
  "whitney",
  "morty",
  "chuck",
  "jasmine",
  "pryce",
  "clair",
  "will",
  "koga",
  "bruno",
  "karen",
  "lance",
  "brock",
  "misty",
  "lt_surge",
  "erika",
  "janine",
  "sabrina",
  "blaine",
  "blue",
  "red",
  "lorelei",
  "agatha",
  "giovanni",
] as const;

export type Trainer = (typeof TRAINERS)[number];

export function isTrainer(key: unknown): key is Trainer {
  return typeof key === "string" && (TRAINERS as readonly string[]).includes(key);
}

/** The trainer's name: the key in title case, `_` as a space (`lt_surge` → "Lt Surge"). */
export function trainerName(key: Trainer): string {
  return key
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export const trainerSprite = (key: Trainer) => `/sprites/trainers/${key}.png`;

/**
 * The player a trainer key makes: the trainer's name is the player's name. Null for
 * anything that isn't a trainer. Every name fits `MAX_NAME_LENGTH`.
 */
export function playerFromTrainer(key: unknown): { name: string; trainer: Trainer } | null {
  if (!isTrainer(key)) return null;
  const name = normalizeName(trainerName(key));
  return name ? { name, trainer: key } : null;
}
