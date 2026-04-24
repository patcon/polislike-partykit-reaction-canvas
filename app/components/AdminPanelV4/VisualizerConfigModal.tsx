import type { VizConfig } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  vizConfig: VizConfig;
  sendVizConfig: (partial: Partial<VizConfig>) => void;
}

const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };
const LABEL: React.CSSProperties = { color: '#888', fontSize: 12, minWidth: 100, flexShrink: 0 };
const SECTION: React.CSSProperties = { borderTop: '1px solid #2a2a2a', paddingTop: 12, marginTop: 12 };
const HEADING: React.CSSProperties = { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

function BtnGroup({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 3,
            border: '0.5px solid',
            borderColor: value === o.value ? 'rgba(200,198,190,.35)' : 'rgba(200,198,190,.15)',
            background: value === o.value ? 'rgba(200,198,190,.12)' : 'transparent',
            color: value === o.value ? 'rgba(200,198,190,.9)' : 'rgba(200,198,190,.45)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Slider({ min, max, step, value, onChange, fmt }: { min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ color: '#888', fontSize: 11, minWidth: 36, textAlign: 'right' }}>{fmt ? fmt(value) : value}</span>
    </div>
  );
}

export default function VisualizerConfigModal({ open, onClose, vizConfig: c, sendVizConfig: set }: Props) {
  if (!open) return null;
  return (
    <div className="github-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="github-modal" style={{ maxWidth: 480, maxHeight: '80vh', overflowY: 'auto' }}>
        <p className="github-modal-title">Visualizer settings</p>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 16 }}>Changes are broadcast live to all Visualizer viewers.</p>

        {/* View */}
        <div style={SECTION}>
          <p style={HEADING}>View</p>
          <div style={ROW}>
            <span style={LABEL}>View mode</span>
            <BtnGroup options={[{ label: '2D time slice', value: '2d' }, { label: '2D time series', value: '2d-ts' }, { label: '3D', value: '3d' }]} value={c.viewMode} onChange={v => set({ viewMode: v as VizConfig['viewMode'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Geometry</span>
            <BtnGroup options={[{ label: 'parallel', value: 'parallel' }, { label: 'linear', value: 'linear' }, { label: 'diametric', value: 'diametric' }, { label: 'radial', value: 'radial' }]} value={c.geometry} onChange={v => set({ geometry: v as VizConfig['geometry'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Animation</span>
            <BtnGroup options={[{ label: 'sequential', value: 'sequential' }, { label: 'simultaneous', value: 'simultaneous' }]} value={c.animation} onChange={v => set({ animation: v as VizConfig['animation'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Traces</span>
            <BtnGroup options={[{ label: 'correlated', value: 'correlated' }, { label: 'random', value: 'random' }]} value={c.traces} onChange={v => set({ traces: v as VizConfig['traces'] })} />
          </div>
          {c.traces === 'correlated' && (
            <div style={ROW}>
              <span style={LABEL}>Order</span>
              <BtnGroup options={[{ label: 'random', value: 'random' }, { label: 'grouped', value: 'grouped' }]} value={c.order} onChange={v => set({ order: v as VizConfig['order'] })} />
            </div>
          )}
        </div>

        {/* Display */}
        <div style={SECTION}>
          <p style={HEADING}>Display</p>
          <div style={ROW}>
            <span style={LABEL}>Chords</span>
            <Slider min={0} max={100} step={1} value={c.chords} onChange={v => set({ chords: v })} />
          </div>
          {c.traces === 'correlated' && (
            <div style={ROW}>
              <span style={LABEL}>Groups</span>
              <Slider min={1} max={7} step={1} value={c.groups} onChange={v => set({ groups: v })} />
            </div>
          )}
          <div style={ROW}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#aaa', fontSize: 13 }}>
              <input type="checkbox" checked={c.showGuides} onChange={e => set({ showGuides: e.target.checked })} />
              Show guides
            </label>
          </div>
        </div>

        {/* Style */}
        <div style={SECTION}>
          <p style={HEADING}>Style</p>
          <div style={ROW}>
            <span style={LABEL}>Cursor style</span>
            <BtnGroup options={[{ label: 'valence', value: 'valence' }, { label: 'group', value: 'group' }]} value={c.cursorStyle} onChange={v => set({ cursorStyle: v as VizConfig['cursorStyle'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Radial style</span>
            <BtnGroup options={[{ label: 'valence', value: 'valence' }, { label: 'group', value: 'group' }]} value={c.radialStyle} onChange={v => set({ radialStyle: v as VizConfig['radialStyle'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Trace style</span>
            <BtnGroup options={[{ label: 'valence', value: 'valence' }, { label: 'group', value: 'group' }]} value={c.traceStyle} onChange={v => set({ traceStyle: v as VizConfig['traceStyle'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Fill style</span>
            <BtnGroup options={[{ label: 'valence', value: 'valence' }, { label: 'group', value: 'group' }]} value={c.fillStyle} onChange={v => set({ fillStyle: v as VizConfig['fillStyle'] })} />
          </div>
          <div style={ROW}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#aaa', fontSize: 13 }}>
              <input type="checkbox" checked={c.stylePastLikeCursor} onChange={e => set({ stylePastLikeCursor: e.target.checked })} />
              Style past like cursor
            </label>
          </div>
        </div>

        {/* Opacity */}
        <div style={SECTION}>
          <p style={HEADING}>Opacity</p>
          <div style={ROW}>
            <span style={LABEL}>Cursor</span>
            <Slider min={0} max={1} step={0.02} value={c.cursorOpacity} onChange={v => set({ cursorOpacity: v })} fmt={v => v.toFixed(2)} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Radial</span>
            <Slider min={0} max={1} step={0.02} value={c.radialOpacity} onChange={v => set({ radialOpacity: v })} fmt={v => v.toFixed(2)} />
          </div>
        </div>

        {/* Colors */}
        <div style={SECTION}>
          <p style={HEADING}>Colors</p>
          <div style={ROW}>
            <span style={LABEL}>Positive</span>
            <input type="color" value={c.colorPositive} onChange={e => set({ colorPositive: e.target.value })} style={{ width: 32, height: 22, border: 'none', cursor: 'pointer', background: 'none' }} />
            <span style={{ color: '#666', fontSize: 11 }}>{c.colorPositive}</span>
          </div>
          <div style={ROW}>
            <span style={LABEL}>Negative</span>
            <input type="color" value={c.colorNegative} onChange={e => set({ colorNegative: e.target.value })} style={{ width: 32, height: 22, border: 'none', cursor: 'pointer', background: 'none' }} />
            <span style={{ color: '#666', fontSize: 11 }}>{c.colorNegative}</span>
          </div>
          <div style={ROW}>
            <span style={LABEL}>Neutral</span>
            <input type="color" value={c.colorNeutral} onChange={e => set({ colorNeutral: e.target.value })} style={{ width: 32, height: 22, border: 'none', cursor: 'pointer', background: 'none' }} />
            <span style={{ color: '#666', fontSize: 11 }}>{c.colorNeutral}</span>
          </div>
        </div>

        {/* Timing */}
        <div style={SECTION}>
          <p style={HEADING}>Timing</p>
          <div style={ROW}>
            <span style={LABEL}>Event every</span>
            <Slider min={3} max={30} step={1} value={c.eventFrequency} onChange={v => set({ eventFrequency: v })} fmt={v => `${v}s`} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Drift speed</span>
            <Slider min={0.005} max={0.06} step={0.005} value={c.driftSpeed} onChange={v => set({ driftSpeed: v })} fmt={v => v.toFixed(3)} />
          </div>
        </div>

        {/* Geometry */}
        <div style={SECTION}>
          <p style={HEADING}>Geometry</p>
          <div style={ROW}>
            <span style={LABEL}>Radial width</span>
            <Slider min={0} max={4} step={0.1} value={c.radialWidth} onChange={v => set({ radialWidth: v })} fmt={v => v.toFixed(1)} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Cursor size</span>
            <Slider min={0} max={60} step={0.5} value={c.cursorSize} onChange={v => set({ cursorSize: v })} fmt={v => v.toFixed(0)} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Exit animation</span>
            <BtnGroup options={[{ label: 'origin', value: 'origin' }, { label: 'none', value: 'none' }]} value={c.exitAnimation} onChange={v => set({ exitAnimation: v as VizConfig['exitAnimation'] })} />
          </div>
          <div style={ROW}>
            <span style={LABEL}>Persistence</span>
            <BtnGroup options={[{ label: 'persistent', value: 'persistent' }, { label: 'redistributed', value: 'redistributed' }]} value={c.chordPersistence} onChange={v => set({ chordPersistence: v as VizConfig['chordPersistence'] })} />
          </div>
          <div style={ROW}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#aaa', fontSize: 13 }}>
              <input type="checkbox" checked={c.useGeometry} onChange={e => set({ useGeometry: e.target.checked })} />
              Use geometry (variable line width)
            </label>
          </div>
        </div>

        <button className="github-modal-btn-dismiss" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
      </div>
    </div>
  );
}
