import Image from "next/image";
import styles from "./crystal.module.scss";

/**
 * A Pokémon icon at `size` px. The sprite files are 32×64 with two stacked
 * animation frames; the icon alternates between them every 200ms.
 */
export function PokemonIcon({ src, size, alt = "" }: { src: string; size: number; alt?: string }) {
  return (
    <span className={styles.pokemonIcon} style={{ width: size, height: size }}>
      <Image className={styles.pokemonIcon__sprite} src={src} alt={alt} width={size} height={size * 2} unoptimized />
    </span>
  );
}
