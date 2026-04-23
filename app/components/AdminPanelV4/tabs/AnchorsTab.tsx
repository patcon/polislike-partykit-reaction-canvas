const inputStyle: React.CSSProperties = {
  background: '#333',
  border: '1px solid #555',
  color: '#eee',
  padding: '4px 8px',
  borderRadius: 4,
  width: 64,
};

interface AnchorsTabProps {
  positiveX: string; setPositiveX: (v: string) => void;
  positiveY: string; setPositiveY: (v: string) => void;
  negativeX: string; setNegativeX: (v: string) => void;
  negativeY: string; setNegativeY: (v: string) => void;
  neutralX: string;  setNeutralX:  (v: string) => void;
  neutralY: string;  setNeutralY:  (v: string) => void;
  sendAnchors: () => void;
  resetAnchors: () => void;
}

export default function AnchorsTab({
  positiveX, setPositiveX, positiveY, setPositiveY,
  negativeX, setNegativeX, negativeY, setNegativeY,
  neutralX,  setNeutralX,  neutralY,  setNeutralY,
  sendAnchors, resetAnchors,
}: AnchorsTabProps) {
  return (
    <div>
      <p style={{ marginBottom: 12, fontWeight: 600 }}>Coordinate system:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input type="radio" name="coordSystem" value="barycentric" checked readOnly style={{ marginRight: 8 }} />
          Barycentric
        </label>
        <label style={{ display: 'block', color: '#666', cursor: 'not-allowed' }}>
          <input type="radio" name="coordSystem" value="linear" disabled style={{ marginRight: 8 }} />
          Linear <span style={{ fontSize: 12, color: '#555' }}>(coming soon)</span>
        </label>
      </div>

      <p style={{ marginBottom: 4, fontWeight: 600 }}>Anchor positions (shared for all participants):</p>
      <p style={{ marginBottom: 12, color: '#888', fontSize: 13 }}>Values are percentages (0–100) of the canvas width/height.</p>
      <button
        className="v3-admin-btn"
        style={{ marginBottom: 16, padding: '6px 14px', fontSize: 13 }}
        onClick={resetAnchors}
      >
        Reset to defaults
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {([
          ['Positive', positiveX, setPositiveX, positiveY, setPositiveY],
          ['Negative', negativeX, setNegativeX, negativeY, setNegativeY],
          ['Neutral',  neutralX,  setNeutralX,  neutralY,  setNeutralY],
        ] as const).map(([label, xVal, xSetter, yVal, ySetter]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 72, color: '#aaa', fontSize: 13 }}>{label}</span>
            <label style={{ fontSize: 13, color: '#888', marginRight: 4 }}>X</label>
            <input
              type="number" min={0} max={100} value={xVal}
              onChange={e => xSetter(e.target.value)}
              style={inputStyle}
            />
            <label style={{ fontSize: 13, color: '#888', marginRight: 4 }}>Y</label>
            <input
              type="number" min={0} max={100} value={yVal}
              onChange={e => ySetter(e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <button className="v3-admin-btn" style={{ marginTop: 16 }} onClick={sendAnchors}>
        Apply Anchors
      </button>
    </div>
  );
}
