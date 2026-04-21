interface InterfaceChip {
  key: string;
  label: string;
}

interface InterfaceChipBarProps {
  interfaces: InterfaceChip[];
  active: string;
  onSelect: (key: string) => void;
}

export default function InterfaceChipBar({ interfaces, active, onSelect }: InterfaceChipBarProps) {
  return (
    <div className="interface-chip-bar">
      {interfaces.map(({ key, label }) => (
        <button
          key={key}
          className={`interface-chip${active === key ? ' interface-chip--active' : ''}`}
          onClick={() => onSelect(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
