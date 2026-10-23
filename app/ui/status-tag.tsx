import styles from "./crystal.module.scss";

/** Placeholder tags until the status sprites exist (docs/design/README.md, Battle). Badly poisoned shows as PSN. */
const TAGS: Record<string, [label: string, colour: string]> = {
  slp: ["SLP", "#585858"],
  frz: ["FRZ", "#70cbd4"],
  brn: ["BRN", "#e04030"],
  psn: ["PSN", "#b468b7"],
  tox: ["PSN", "#b468b7"],
  par: ["PAR", "#e5c531"],
};

/** A status condition's 64×24 tag, for the status slot. Nothing for no status. */
export function StatusTag({ status }: { status: string | null }) {
  const tag = status ? TAGS[status] : undefined;
  if (!tag) return null;
  return (
    <span className={styles.statusTag} style={{ background: tag[1] }}>
      {tag[0]}
    </span>
  );
}
