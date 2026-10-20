import Image from "next/image";
import styles from "./crystal.module.css";

/**
 * A Pokémon icon at `size` px. The sprite files are 32×64 with two stacked
 * animation frames, so only the top frame is shown.
 */
export function PokemonIcon({ src, size, alt = "" }: { src: string; size: number; alt?: string }) {
  return (
    <span className={styles.icon} style={{ width: size, height: size }}>
      <Image className={styles.pixel} src={src} alt={alt} width={size} height={size * 2} unoptimized />
    </span>
  );
}
