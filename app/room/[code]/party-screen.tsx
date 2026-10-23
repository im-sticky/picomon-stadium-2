"use client";

import type { Clock } from "@/lib/battle-feed";
import type { TeamMember } from "@/lib/battle-types";
import type { PoolPokemon } from "@/lib/draft-pool";
import { Frame } from "@/app/ui/frame";
import { HpBar, StatusSlot } from "@/app/ui/hp-bar";
import { PokemonIcon } from "@/app/ui/pokemon-icon";
import { Stage } from "@/app/ui/stage";
import { StatusTag } from "@/app/ui/status-tag";
import { Countdown } from "./countdown";
import { MenuItem } from "./battle-menu";
import styles from "./party.module.scss";

/**
 * Your Pokémon (board 4f): your battle team with HP and status. A row opens its
 * Detail. In a forced switch there's no BACK, so you can't leave until you pick.
 */
export function PartyScreen({
  title,
  team,
  pool,
  clock,
  forced,
  onOpen,
  onBack,
}: {
  title: string;
  team: TeamMember[];
  pool: ReadonlyMap<string, PoolPokemon>;
  clock: Clock | null;
  forced: boolean;
  onOpen: (index: number) => void;
  onBack: () => void;
}) {
  return (
    <Stage className={styles.party}>
      <h1 className={styles.party__title}>{title}</h1>
      <ul className={styles.party__team} aria-label="Your Pokémon">
        {team.map((member, i) => {
          const name = (pool.get(member.pokemonId)?.name ?? member.details.split(",")[0]).toUpperCase();
          const hp = member.fainted ? 0 : member.hp;
          const status = member.fainted ? null : member.status;
          return (
            <li key={member.pokemonId}>
              <button
                type="button"
                className={styles.party__row}
                aria-label={`${name}, ${hp} of ${member.maxhp} HP${status ? `, ${status.toUpperCase()}` : ""}`}
                onClick={() => onOpen(i)}
              >
                <PokemonIcon src={pool.get(member.pokemonId)?.sprite ?? ""} size={64} />
                <span className={styles.party__nameBlock}>
                  <span className={styles.party__name}>{name}</span>
                  <span className={styles.party__level}>
                    <StatusSlot className={styles.party__status}>
                      <StatusTag status={status} />
                    </StatusSlot>
                    <span>L50</span>
                  </span>
                </span>
                <span className={styles.party__hp}>
                  <span className={styles.party__hpNumbers}>
                    {hp}/{member.maxhp}
                  </span>
                  <span className={styles.party__hpRow}>
                    <HpBar value={hp} max={member.maxhp} className={styles.party__hpBar} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={styles.party__bottom}>
        <Frame className={styles.party__message}>
          <p role="status" className={styles.party__prompt}>
            Choose a POKéMON.
          </p>
          {clock && <Countdown clock={clock} />}
        </Frame>
        <Frame className={styles.party__options} role="menu">
          {!forced && <MenuItem onClick={onBack}>BACK</MenuItem>}
        </Frame>
      </div>
    </Stage>
  );
}
