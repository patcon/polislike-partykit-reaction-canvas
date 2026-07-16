interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  fmt?: (v: number) => string | number;
}

export default function Slider({ label, value, min, max, step, onChange, fmt = (v) => v }: SliderProps) {
  return (
    <label style={{ display: 'block', marginBottom: 10, fontSize: 12, color: '#333' }}>
      <span style={{ display: 'block', marginBottom: 2 }}>
        {label} <b>{fmt(value)}</b>
      </span>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={(ev) => onChange(parseFloat(ev.target.value))}
        style={{ width: '100%' }}
      />
    </label>
  );
}
