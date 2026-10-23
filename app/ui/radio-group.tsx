import styles from "./crystal.module.scss";

export type RadioOption<T> = { value: T; label: string };

/**
 * Pixel-square radios, one row of them (or stacked with `vertical`); `label` names the
 * group for screen readers.
 */
export function RadioGroup<T extends string | number>({
  label,
  name,
  options,
  value,
  onChange,
  vertical,
  className,
}: {
  label: string;
  name: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  vertical?: boolean;
  className?: string;
}) {
  return (
    <fieldset
      className={[styles.radioGroup, vertical && styles["radioGroup--vertical"], className].filter(Boolean).join(" ")}
      aria-label={label}
    >
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
