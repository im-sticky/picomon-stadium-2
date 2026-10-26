import { useId } from "react";
import styles from "./crystal.module.scss";

export type RadioOption<T> = { value: T; label: string };

/**
 * Pixel-square radios, one row of them (or stacked with `vertical`). `label` names the
 * group: for screen readers only, or shown above the radios as a section label with `titled`.
 */
export function RadioGroup<T extends string | number>({
  label,
  name,
  options,
  value,
  onChange,
  vertical,
  titled,
  className,
}: {
  label: string;
  name: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  vertical?: boolean;
  titled?: boolean;
  className?: string;
}) {
  const titleId = useId();
  return (
    <fieldset
      className={[styles.radioGroup, vertical && styles["radioGroup--vertical"], className].filter(Boolean).join(" ")}
      aria-label={titled ? undefined : label}
      aria-labelledby={titled ? titleId : undefined}
    >
      {titled && (
        <p id={titleId} className={styles.radioGroup__title}>
          {label}
        </p>
      )}
      {options.map((option) => (
        <label key={option.value} className={styles.radioGroup__option}>
          <input
            className={styles.radioGroup__input}
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
