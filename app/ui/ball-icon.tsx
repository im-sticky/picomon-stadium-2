import Image from "next/image";
import type { PoolPokemon } from "@/lib/draft-pool";
import styles from "./crystal.module.scss";

/** A Pokémon's ball tier: the 32px Poké, Great, Ultra or Master Ball icon. */
export function BallIcon({ pokemon }: { pokemon: Pick<PoolPokemon, "isMaster" | "isUltra" | "isGreat"> }) {
  const [ball, alt] = pokemon.isMaster
    ? ["masterball", "Master"]
    : pokemon.isUltra
      ? ["ultraball", "Ultra"]
      : pokemon.isGreat
        ? ["greatball", "Great"]
        : ["pokeballball", ""];
  return <Image className={styles.ballIcon} src={`/sprites/misc/icon-${ball}.png`} alt={alt} width={32} height={32} unoptimized />;
}
