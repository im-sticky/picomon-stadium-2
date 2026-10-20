import styles from "./crystal.module.css";

/** The agreed type colours (docs/design/README.md). "???" is for unknown or typeless. */
export const TYPE_COLOURS: Record<string, string> = {
  BUG: "#94bc4a",
  DARK: "#736c75",
  DRAGON: "#6a7baf",
  ELECTRIC: "#e5c531",
  FAIRY: "#e397d1",
  FIGHTING: "#cb5f48",
  FIRE: "#ea7a3c",
  FLYING: "#7da6de",
  GHOST: "#846ab6",
  GRASS: "#71c558",
  GROUND: "#cc9f4f",
  ICE: "#70cbd4",
  NORMAL: "#aab09f",
  POISON: "#b468b7",
  PSYCHIC: "#e5709b",
  ROCK: "#b2a061",
  STEEL: "#89a1b0",
  WATER: "#539ae2",
  "???": "#81a596",
};

/** 148×28 pixel-notched type badge. `type` is a type name in any case, e.g. "Grass". */
export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const label = TYPE_COLOURS[type.toUpperCase()] ? type.toUpperCase() : "???";
  return (
    <span className={`${styles.typeBadge} ${className ?? ""}`} style={{ background: TYPE_COLOURS[label] }}>
      {label}
    </span>
  );
}
