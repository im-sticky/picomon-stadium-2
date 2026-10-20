import Image from "next/image";
import styles from "./crystal.module.scss";

/** A Pokémon's held item: the 32px item icon, then the item name in 16px. */
export function HeldItem({ item }: { item: string }) {
  return (
    <div className={styles.heldItem} aria-label="Held item">
      <Image className={styles.heldItem__icon} src="/sprites/misc/icon-item.png" alt="Held item" width={32} height={32} unoptimized />
      <span>{item}</span>
    </div>
  );
}
