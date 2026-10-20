import styles from "./crystal.module.css";

export type RadioOption<T> = { value: T; label: string };

/** One row of pixel-square radios; `label` names the group for screen readers. */
export function RadioGroup<T extends string | number>({
  label,
  name,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  name: string;
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <fieldset className={`${styles.radioGroup} ${className ?? ""}`} aria-label={label}>
      {options.map((option) => (
        <label key={option.value} className={styles.radio}>
          <input
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
