import Image from "next/image";
import type { PokemonSprite } from "@/data/pokemon-sprites";
import styles from "./crystal.module.scss";

/** A Pokémon's static back battle sprite, bottom-centred in the same 112px box as the front. */
export function PokemonBack({ sprite, alt = "", className }: { sprite: PokemonSprite; alt?: string; className?: string }) {
  return (
    <span className={className ? `${styles.pokemonSprite} ${className}` : styles.pokemonSprite}>
      <Image className={styles.pokemonSprite__back} src={sprite.back} alt={alt} width={sprite.backSize} height={sprite.backSize} unoptimized />
    </span>
  );
}
