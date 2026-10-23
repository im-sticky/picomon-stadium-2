"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { trainerName, trainerSprite, TRAINERS } from "@/lib/trainers";
import { chooseTrainer, useTrainer } from "../trainer-store";
import { PixelScroll } from "../ui/pixel-scroll";
import styles from "./trainers.module.scss";

/** Every trainer, 4 to a row; yours is framed. A row is 252px (240px cell + 12px gap). */
export function TrainerGrid() {
  const router = useRouter();
  const current = useTrainer();
  return (
    <PixelScroll label="Trainers, scrollable" height={744} step={252}>
      <ul className={styles.trainers__grid} aria-label="Trainers">
        {TRAINERS.map((key) => (
          <li key={key}>
            <button
              type="button"
              className={`${styles.trainers__cell} ${key === current ? styles["trainers__cell--current"] : ""}`}
              aria-pressed={key === current}
              onClick={() => {
                chooseTrainer(key);
                router.push("/");
              }}
            >
              <span>{trainerName(key)}</span>
              <Image className={styles.trainers__sprite} src={trainerSprite(key)} alt="" width={168} height={168} unoptimized />
            </button>
          </li>
        ))}
      </ul>
    </PixelScroll>
  );
}
