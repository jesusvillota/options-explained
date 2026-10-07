import { useId } from 'react';
import { RichText } from './Tex';

interface SliderProps {
  /** Label, may contain inline math: "Strike $\Strike{K}$" */
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  /** CSS colour for the thumb and track, e.g. "var(--c-strike)" */
  color?: string;
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, color = 'var(--c-spot)' }: SliderProps) {
  const id = useId();
  return (
    <div className="ctl-slider" style={{ ['--accent' as string]: color }}>
      <label htmlFor={id}>
        <span className="ctl-label"><RichText>{label}</RichText></span>
        <output htmlFor={id} className="ctl-value">{format(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; color?: string }[];
  onChange: (value: T) => void;
}

/** A row of mutually exclusive buttons (like a radio group). */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="ctl-segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'active' : undefined}
          style={o.color ? { ['--accent' as string]: o.color } : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="ctl-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A labelled native drop-down. */
export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  const id = useId();
  return (
    <div className="ctl-select">
      <label htmlFor={id} className="ctl-label">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
