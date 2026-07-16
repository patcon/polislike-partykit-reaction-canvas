import Slider from './Slider';
import type { Params } from './types';

export default function ConfigDrawer({
  params,
  onChange,
  showCursors,
  onShowCursorsChange,
  collapsed,
  onToggleCollapsed,
}: {
  params: Params;
  onChange: (params: Params) => void;
  showCursors: boolean;
  onShowCursorsChange: (v: boolean) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const set = <K extends keyof Params>(key: K, value: Params[K]) => onChange({ ...params, [key]: value });

  return (
    <div
      style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        fontFamily: 'sans-serif',
        color: '#222',
        width: collapsed ? 'auto' : 220,
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', padding: '8px 12px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: '#222',
        }}
      >
        Particle Field settings
        <span style={{ fontSize: 10, opacity: 0.6 }}>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 12px 12px' }}>
          <Slider label="Force scale" value={params.forceScale} min={0} max={300} step={5}
            onChange={(v) => set('forceScale', v)} />
          <Slider label="Proximity range" value={params.proximityRange} min={0.05} max={1.4} step={0.01}
            onChange={(v) => set('proximityRange', v)} fmt={(v) => v.toFixed(2)} />
          <Slider label="Core radius" value={params.coreRadius} min={4} max={60} step={1}
            onChange={(v) => set('coreRadius', v)} />
          <Slider label="Falloff" value={params.falloff} min={40} max={500} step={5}
            onChange={(v) => set('falloff', v)} />
          <Slider label="Friction" value={params.friction} min={0} max={0.3} step={0.005}
            onChange={(v) => set('friction', v)} fmt={(v) => v.toFixed(3)} />
          <Slider label="Max speed" value={params.maxSpeed} min={50} max={1000} step={10}
            onChange={(v) => set('maxSpeed', v)} />
          <Slider label="Center gravity" value={params.centerGravity} min={0} max={4} step={0.05}
            onChange={(v) => set('centerGravity', v)} fmt={(v) => v.toFixed(2)} />
          <Slider label="Particles per cursor" value={params.multiplier} min={1} max={12} step={1}
            onChange={(v) => set('multiplier', v)} />

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 4 }}>
            <input type="checkbox" checked={params.invert} onChange={(e) => set('invert', e.target.checked)} />
            Invert attract/repel
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 6 }}>
            <input type="checkbox" checked={showCursors} onChange={(e) => onShowCursorsChange(e.target.checked)} />
            Show cursor dots
          </label>
        </div>
      )}
    </div>
  );
}
