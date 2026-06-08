import { useState, useRef, useEffect, useCallback } from "react";
import usePartySocket from 'partysocket/react';
import { usePanelContext } from "../../app/context/PanelContext";
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { generateUUID } from '../../app/utils/userId';
import { computeCursorValence } from '../../app/utils/voteRegion';

// ── Constants ──────────────────────────────────────────────────────

const KEY_MAP    = ['7','8','9','0','u','i','o','p','j','k','l',';','m',',','.','/'];
const KEY_LABELS = ['7','8','9','0','U','I','O','P','J','K','L',';','M',',','.','/'];

const CHORD_COLORS: Record<string, { bg: string; tx: string; label: string }> = {
  maj:  { bg:'#1D9E75', tx:'#E1F5EE', label:'maj'  },
  min:  { bg:'#7F77DD', tx:'#EEEDFE', label:'min'  },
  dim:  { bg:'#D85A30', tx:'#FAECE7', label:'dim'  },
  aug:  { bg:'#EF9F27', tx:'#FAEEDA', label:'aug'  },
  maj7: { bg:'#1D9E75', tx:'#E1F5EE', label:'maj7' },
  min7: { bg:'#7F77DD', tx:'#EEEDFE', label:'min7' },
  dom7: { bg:'#BA7517', tx:'#FAEEDA', label:'7'    },
  dim7: { bg:'#993C1D', tx:'#FAECE7', label:'dim7' },
  sus2: { bg:'#378ADD', tx:'#E6F1FB', label:'sus2' },
  sus4: { bg:'#185FA5', tx:'#E6F1FB', label:'sus4' },
};

const CHORD_SHAPES: Record<string, number[]> = {
  maj:  [0,4,7],
  min:  [0,3,7],
  dim:  [0,3,6],
  aug:  [0,4,8],
  maj7: [0,4,7,11],
  min7: [0,3,7,10],
  dom7: [0,4,7,10],
  dim7: [0,3,6,9],
  sus2: [0,2,7],
  sus4: [0,5,7],
};

const NOTE_NAMES = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

const SCALES: Record<string, number[]> = {
  lydian:   [0,2,4,6,7,9,11,12,14,16,18,19,21,23,24,14],
  minor:    [0,2,3,5,7,8,10,12,14,15,17,19,20,22,24,15],
  phrygian: [0,1,3,5,7,8,10,12,13,15,17,19,20,22,24,13],
};

const NAMES: Record<string, string[]> = {
  lydian:   ['C','D','E','F#','G','A','B','C²','D²','E²','F#²','G²','A²','B²','C³','D²'],
  minor:    ['C','D','Eb','F','G','Ab','Bb','C²','D²','Eb²','F²','G²','Ab²','Bb²','C³','Eb²'],
  phrygian: ['C','Db','Eb','F','G','Ab','Bb','C²','Db²','Eb²','F²','G²','Ab²','Bb²','C³','Db²'],
};

const ROLES = ['root','2nd','3rd','tritone','5th','6th','7th','oct','9th','10th','♯11','12th','13th','14th','2oct','hi'];

const PAD_POS = '#5DCAA5', PAD_MID = '#AFA9EC', PAD_NEG = '#D85A30';
const TEXT_POS = '#04342C', TEXT_MID = '#26215C', TEXT_NEG = '#4A1B0C';


// ── Types ──────────────────────────────────────────────────────────

interface ChordResult {
  name: string;
  type: string;
  chordPcs: number[];
  padIdxs: number[];
}

interface SustainedNote {
  o1: OscillatorNode;
  o2: OscillatorNode;
  gain: GainNode;
}

// ── Pure helpers ───────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function lerpHex(h1: string, h2: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(h1), [r2,g2,b2] = p(h2);
  return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`;
}

function getScale(t: number): string {
  return t > .55 ? 'lydian' : t > .25 ? 'minor' : 'phrygian';
}

function getPadBg(t: number): string {
  return t > .5 ? lerpHex(PAD_MID, PAD_POS, (t - .5) * 2) : lerpHex(PAD_NEG, PAD_MID, t * 2);
}

function getPadText(t: number): string {
  return t > .5 ? lerpHex(TEXT_MID, TEXT_POS, (t - .5) * 2) : lerpHex(TEXT_NEG, TEXT_MID, t * 2);
}

function getScaleLabel(t: number): string {
  const sc = getScale(t);
  return sc === 'lydian' ? 'Lydian' : sc === 'minor' ? 'Nat. minor' : 'Phrygian';
}

function getTimbreLabel(t: number): string {
  const neg = 1 - t;
  return neg < .4 ? 'Sine / warm' : neg < .75 ? 'Triangle / muted' : 'Sawtooth / raw';
}

function getReverbLabel(t: number): string {
  const neg = 1 - t;
  return neg < .35 ? 'Dry' : neg < .7 ? 'Room' : 'Wet cave';
}

function getPeriodMs(spd: number): number {
  return spd <= 50
    ? Math.round(lerp(300000, 60000, spd / 50))
    : Math.round(lerp(60000, 5000, (spd - 50) / 50));
}

function formatPeriod(ms: number): string {
  return ms >= 60000 ? Math.round(ms / 60000) + 'm / cycle' : Math.round(ms / 1000) + 's / cycle';
}

function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function findChordsForAnchor(idx: number, t: number): ChordResult[] {
  const sc = getScale(t);
  const semis = SCALES[sc];
  const anchorPc = ((semis[idx] % 12) + 12) % 12;
  const allPcs = semis.map(s => ((s % 12) + 12) % 12);
  const allPcSet = new Set(allPcs);
  const results: ChordResult[] = [];
  for (const [type, intervals] of Object.entries(CHORD_SHAPES)) {
    for (let root = 0; root < 12; root++) {
      const chordPcs = intervals.map(i => (root + i) % 12);
      if (!chordPcs.includes(anchorPc)) continue;
      if (!chordPcs.every(pc => allPcSet.has(pc))) continue;
      const padIdxs = chordPcs.map(cp => allPcs.findIndex(p => p === cp));
      if (padIdxs.some(i => i === -1)) continue;
      const cc = CHORD_COLORS[type];
      results.push({ name: NOTE_NAMES[root] + (cc?.label || type), type, chordPcs, padIdxs });
    }
  }
  const seen = new Set<string>();
  return results.filter(c => { if (seen.has(c.name)) return false; seen.add(c.name); return true; }).slice(0, 6);
}

const KEY_TO_IDX = Object.fromEntries(KEY_MAP.map((k, i) => [k, i]));

// ── Component ──────────────────────────────────────────────────────

export default function ValenceBeatPadPanel() {
  const { room } = usePanelContext();

  const [valence, setValence]           = useState(100);
  const [audienceSync, setAudienceSync] = useState(true);
  const [oscActive, setOscActive]       = useState(false);
  const [oscSpeed, setOscSpeed]         = useState(50);
  const [heldPads, setHeldPads]         = useState<Set<number>>(new Set());
  const [anchorIdx, setAnchorIdx]       = useState<number | null>(null);
  const [frozenChords, setFrozenChords] = useState<ChordResult[]>([]);
  const [activeChordNum, setActiveChordNum] = useState<number | null>(null);
  const [activeChordPads, setActiveChordPads] = useState<Set<number>>(new Set());
  const [wsStatus, setWsStatus]         = useState<'disconnected'|'connecting'|'connected'>('disconnected');
  const [audienceCount, setAudienceCount] = useState(0);

  // Refs for audio
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const reverbRef    = useRef<ConvolverNode | null>(null);
  const masterRef    = useRef<GainNode | null>(null);
  const sustainedRef = useRef<Map<number, SustainedNote>>(new Map());

  // Refs for stale-closure avoidance
  const valenceRef        = useRef(100);
  const audienceSyncRef   = useRef(true);
  const oscActiveRef      = useRef(false);
  const oscPhaseRef       = useRef(Math.PI / 2);
  const oscLastTsRef      = useRef<number | null>(null);
  const oscRafRef         = useRef<number | null>(null);
  const oscSpeedRef       = useRef(50);
  const heldOrderRef      = useRef<number[]>([]);
  const anchorIdxRef      = useRef<number | null>(null);
  const frozenChordsRef   = useRef<ChordResult[]>([]);
  const activeChordNumRef = useRef<number | null>(null);
  const activeChordPadsRef= useRef<Set<number>>(new Set());
  const lockedValenceRef  = useRef<number | null>(null);

  const socketUserId = useRef(generateUUID());
  const cursorsRef   = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Keep refs in sync
  useEffect(() => { valenceRef.current = valence; }, [valence]);
  useEffect(() => { audienceSyncRef.current = audienceSync; }, [audienceSync]);
  useEffect(() => { oscActiveRef.current = oscActive; }, [oscActive]);
  useEffect(() => { oscSpeedRef.current = oscSpeed; }, [oscSpeed]);

  // ── Valence lock ─────────────────────────────────────────────────
  // Returns the locked valence when pads are held, live valence otherwise.
  // To disable locking, change this to always return valenceRef.current.
  function getPlayValence() { return lockedValenceRef.current ?? valenceRef.current; }

  // ── Audio ────────────────────────────────────────────────────────

  function ensureCtx() {
    if (audioCtxRef.current) return;
    const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const mg = ctx.createGain(); mg.gain.value = 0.65; mg.connect(ctx.destination);
    const len = ctx.sampleRate * 2.5;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const conv = ctx.createConvolver(); conv.buffer = buf; conv.connect(mg);
    audioCtxRef.current = ctx;
    masterRef.current = mg;
    reverbRef.current = conv;
  }

  function startNote(idx: number) {
    ensureCtx();
    const ctx = audioCtxRef.current!;
    if (ctx.state === 'suspended') void ctx.resume();
    if (sustainedRef.current.has(idx)) return;
    const t = getPlayValence() / 100;
    const sc = getScale(t);
    const freq = 261.63 * Math.pow(2, SCALES[sc][idx] / 12);
    const neg = 1 - t;
    const now = ctx.currentTime;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = neg < .4 ? 'sine'     : neg < .75 ? 'triangle'  : 'sawtooth';
    o2.type = neg < .4 ? 'triangle' : neg < .75 ? 'sawtooth'  : 'square';
    o1.frequency.value = freq;
    o2.frequency.value = freq * (1 + lerp(0, 0.008, neg));
    const b1 = ctx.createGain(), b2 = ctx.createGain();
    b1.gain.value = lerp(.85, .45, neg); b2.gain.value = lerp(.15, .55, neg);
    o1.connect(b1); o2.connect(b2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lerp(7000, 1100, neg);
    filt.Q.value = lerp(.5, 7, neg);
    b1.connect(filt); b2.connect(filt);
    const k = lerp(0, 70, neg);
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i * 2 / 255 - 1;
      curve[i] = k > 0 ? (Math.PI + k) * x / (Math.PI + k * Math.abs(x)) : x;
    }
    dist.curve = curve;
    filt.connect(dist);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(lerp(.45, .2, neg), now + lerp(.01, .05, neg));
    dist.connect(gain);
    gain.connect(masterRef.current!);
    if (reverbRef.current) {
      const rs = ctx.createGain(); rs.gain.value = lerp(.04, .55, neg);
      gain.connect(rs); rs.connect(reverbRef.current);
    }
    o1.start(now); o2.start(now);
    sustainedRef.current.set(idx, { o1, o2, gain });
  }

  function stopNote(idx: number) {
    const note = sustainedRef.current.get(idx);
    if (!note || !audioCtxRef.current) return;
    const { o1, o2, gain } = note;
    const now = audioCtxRef.current.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    o1.stop(now + 0.35); o2.stop(now + 0.35);
    sustainedRef.current.delete(idx);
  }

  // ── Oscillator ───────────────────────────────────────────────────

  const oscTick = useCallback((ts: number) => {
    if (!oscActiveRef.current) { oscLastTsRef.current = null; return; }
    if (oscLastTsRef.current === null) oscLastTsRef.current = ts;
    const dt = ts - oscLastTsRef.current; oscLastTsRef.current = ts;
    const period = getPeriodMs(oscSpeedRef.current);
    oscPhaseRef.current = (oscPhaseRef.current + dt / period * 2 * Math.PI) % (2 * Math.PI);
    const newVal = Math.round((Math.sin(oscPhaseRef.current) + 1) / 2 * 100);
    valenceRef.current = newVal;
    setValence(newVal);
    oscRafRef.current = requestAnimationFrame(oscTick);
  }, []);

  function toggleOsc() {
    const next = !oscActiveRef.current;
    oscActiveRef.current = next;
    setOscActive(next);
    if (next) {
      const t = valenceRef.current / 100;
      oscPhaseRef.current = Math.asin(Math.max(-1, Math.min(1, t * 2 - 1)));
      oscLastTsRef.current = null;
      oscRafRef.current = requestAnimationFrame(oscTick);
    } else {
      if (oscRafRef.current) cancelAnimationFrame(oscRafRef.current);
    }
  }

  // ── Audience sync ────────────────────────────────────────────────

  const applyAudienceMood = useCallback(() => {
    if (!audienceSyncRef.current) return;
    const cursors = cursorsRef.current;
    if (cursors.size === 0) { valenceRef.current = 50; setValence(50); return; }
    let sum = 0;
    for (const [, c] of cursors) sum += computeCursorValence(c.x, c.y);
    const val = Math.round(clamp(sum / cursors.size, 0, 100));
    valenceRef.current = val;
    setValence(val);
  }, []);

  useEffect(() => {
    if (audienceSync) {
      applyAudienceMood();
      if (oscActiveRef.current) {
        oscActiveRef.current = false;
        setOscActive(false);
        if (oscRafRef.current) cancelAnimationFrame(oscRafRef.current);
      }
    }
  }, [audienceSync, applyAudienceMood]);

  // ── WebSocket ────────────────────────────────────────────────────

  usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { isAdmin: 'true', userId: socketUserId.current },
    onOpen:  () => setWsStatus('connected'),
    onClose: () => setWsStatus('disconnected'),
    onError: () => setWsStatus('disconnected'),
    onMessage(evt) {
      let data: { type: string; count?: number; position?: { userId: string; x: number; y: number }; cursors?: Array<{ type: string; position: { userId: string; x: number; y: number } }> };
      try { data = JSON.parse(evt.data as string); } catch { return; }
      const applyOneCursor = (e: { type: string; position: { userId: string; x: number; y: number } }) => {
        if (e.type === 'move' || e.type === 'touch') {
          const { userId, x, y } = e.position;
          cursorsRef.current.set(userId, { x, y });
          applyAudienceMood();
        } else if (e.type === 'remove') {
          cursorsRef.current.delete(e.position.userId);
          applyAudienceMood();
        }
      };
      if (data.type === 'presenceCount') {
        setAudienceCount(data.count ?? 0);
      } else if (data.type === 'cursorBatch') {
        (data.cursors ?? []).forEach(applyOneCursor);
      } else if (data.type === 'move' || data.type === 'touch' || data.type === 'remove') {
        applyOneCursor(data as { type: string; position: { userId: string; x: number; y: number } });
      }
    },
  });

  // ── Pad interaction ──────────────────────────────────────────────

  const syncChordHighlight = useCallback(() => {
    const held = new Set(heldOrderRef.current);
    for (let i = 0; i < frozenChordsRef.current.length; i++) {
      const { padIdxs } = frozenChordsRef.current[i];
      if (padIdxs.length >= 2 && padIdxs.every(pi => held.has(pi))) {
        if (activeChordNumRef.current !== i + 1) {
          activeChordNumRef.current = i + 1;
          setActiveChordNum(i + 1);
        }
        return;
      }
    }
    // No chord matched — only clear if no chip was explicitly tapped (chip tap sets activeChordPads)
    if (activeChordPadsRef.current.size === 0) {
      activeChordNumRef.current = null;
      setActiveChordNum(null);
    }
  }, []);

  const padDown = useCallback((idx: number) => {
    if (heldOrderRef.current.includes(idx)) return;
    heldOrderRef.current.push(idx);
    startNote(idx);
    if (heldOrderRef.current.length === 1) {
      lockedValenceRef.current = valenceRef.current;
      anchorIdxRef.current = idx;
      const chords = findChordsForAnchor(idx, lockedValenceRef.current / 100);
      frozenChordsRef.current = chords;
      activeChordPadsRef.current.forEach(pi => { if (!heldOrderRef.current.includes(pi)) stopNote(pi); });
      activeChordPadsRef.current = new Set();
      activeChordNumRef.current = null;
      setAnchorIdx(idx);
      setFrozenChords(chords);
      setActiveChordNum(null);
      setActiveChordPads(new Set());
    }
    setHeldPads(new Set(heldOrderRef.current));
    syncChordHighlight();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncChordHighlight]);

  const padUp = useCallback((idx: number) => {
    const i = heldOrderRef.current.indexOf(idx);
    if (i === -1) return;
    heldOrderRef.current.splice(i, 1);
    if (!activeChordPadsRef.current.has(idx)) stopNote(idx);

    if (heldOrderRef.current.length === 0) {
      activeChordPadsRef.current.forEach(pi => stopNote(pi));
      activeChordPadsRef.current = new Set();
      activeChordNumRef.current = null;
      anchorIdxRef.current = null;
      frozenChordsRef.current = [];
      lockedValenceRef.current = null;
      setAnchorIdx(null);
      setFrozenChords([]);
      setActiveChordNum(null);
      setActiveChordPads(new Set());
    } else if (idx === anchorIdxRef.current) {
      const newAnchor = heldOrderRef.current[0];
      anchorIdxRef.current = newAnchor;
      const chords = findChordsForAnchor(newAnchor, getPlayValence() / 100);
      frozenChordsRef.current = chords;
      activeChordPadsRef.current.forEach(pi => { if (!heldOrderRef.current.includes(pi)) stopNote(pi); });
      activeChordPadsRef.current = new Set();
      activeChordNumRef.current = null;
      setAnchorIdx(newAnchor);
      setFrozenChords(chords);
      setActiveChordNum(null);
      setActiveChordPads(new Set());
    }
    setHeldPads(new Set(heldOrderRef.current));
    syncChordHighlight();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncChordHighlight]);

  const selectChord = useCallback((num: number) => {
    if (anchorIdxRef.current === null) return;
    const ci = num - 1;
    if (ci < 0 || ci >= frozenChordsRef.current.length) return;
    activeChordPadsRef.current.forEach(pi => { if (!heldOrderRef.current.includes(pi)) stopNote(pi); });
    if (activeChordNumRef.current === num) {
      activeChordNumRef.current = null;
      activeChordPadsRef.current = new Set();
      setActiveChordNum(null);
      setActiveChordPads(new Set());
    } else {
      activeChordNumRef.current = num;
      const chord = frozenChordsRef.current[ci];
      const pads = new Set(chord.padIdxs);
      activeChordPadsRef.current = pads;
      chord.padIdxs.forEach(pi => { if (!heldOrderRef.current.includes(pi)) startNote(pi); });
      setActiveChordNum(num);
      setActiveChordPads(new Set(pads));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save currently held multi-touch pads as a manual chord
  const saveManualChord = useCallback(() => {
    if (heldOrderRef.current.length < 2) return;
    if (frozenChordsRef.current.length >= 6) return;
    const padIdxs = [...heldOrderRef.current];
    const newChord: ChordResult = { name: padIdxs.map(i => NAMES[getScale(getPlayValence() / 100)][i]).join('+'), type: 'maj', chordPcs: [], padIdxs };
    const updated = [...frozenChordsRef.current, newChord];
    frozenChordsRef.current = updated;
    setFrozenChords(updated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const num = parseInt(k);
      if (num >= 1 && num <= 6 && anchorIdxRef.current !== null) { selectChord(num); return; }
      const idx = KEY_TO_IDX[k];
      if (idx !== undefined) padDown(idx);
    }
    function handleKeyUp(e: KeyboardEvent) {
      const idx = KEY_TO_IDX[e.key.toLowerCase()];
      if (idx !== undefined) padUp(idx);
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [padDown, padUp, selectChord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (oscRafRef.current) cancelAnimationFrame(oscRafRef.current);
      sustainedRef.current.forEach((_, idx) => stopNote(idx));
      if (audioCtxRef.current) { void audioCtxRef.current.close(); audioCtxRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived display ───────────────────────────────────────────────

  const t = valence / 100;
  const padT = (lockedValenceRef.current ?? valence) / 100;
  const sc = getScale(padT);
  const padBg = getPadBg(padT);
  const padTx = getPadText(padT);

  // Build a map of padIdx → first chord number (for badge display)
  const padChordMap = new Map<number, { num: number; chord: ChordResult }>();
  frozenChords.forEach((chord, ci) => {
    chord.padIdxs.forEach(pi => {
      if (pi !== anchorIdx && !padChordMap.has(pi)) padChordMap.set(pi, { num: ci + 1, chord });
    });
  });

  // ── Styles ────────────────────────────────────────────────────────

  const s = {
    wrap: { padding: '1rem', fontFamily: "'Courier New', monospace" } as React.CSSProperties,
    controlRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem', flexWrap: 'wrap' as const },
    lbl: { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#666', whiteSpace: 'nowrap' as const },
    pillToggle: { display: 'flex', background: '#1a1a1a', border: '0.5px solid rgba(255,255,255,0.22)', borderRadius: 100, overflow: 'hidden' },
    pillBtn: (active: boolean): React.CSSProperties => ({
      padding: '3px 10px', fontSize: 11, border: 'none',
      background: active ? 'rgba(255,255,255,0.9)' : 'transparent',
      color: active ? '#111' : '#777', cursor: 'pointer', borderRadius: 100,
    }),
    slider: { flex: 1, accentColor: '#999', cursor: 'pointer' } as React.CSSProperties,
    audienceCount: { fontSize: 11, color: '#555', marginLeft: 'auto' },
    oscBtn: (active: boolean): React.CSSProperties => ({
      fontSize: 11, letterSpacing: '.06em', padding: '4px 12px', borderRadius: 100,
      border: '0.5px solid rgba(255,255,255,0.22)',
      background: active ? 'rgba(255,255,255,0.9)' : 'transparent',
      color: active ? '#111' : '#999', cursor: 'pointer', whiteSpace: 'nowrap',
    }),
    chordStrip: {
      display: 'flex', gap: 5, height: 34, overflowX: 'auto' as const, flexWrap: 'nowrap' as const,
      padding: '2px 0', marginBottom: 8, alignItems: 'center', flexShrink: 0,
    },
    chordChip: (active: boolean, chord: ChordResult): React.CSSProperties => {
      const cc = CHORD_COLORS[chord.type] || { bg: '#444', tx: '#fff' };
      return {
        fontSize: 11, padding: '3px 10px', borderRadius: 100, cursor: 'pointer', border: 'none',
        background: cc.bg, color: cc.tx, fontFamily: "'Courier New', monospace",
        outline: active ? '2px solid white' : 'none', outlineOffset: 2,
        flexShrink: 0, letterSpacing: '.03em',
        fontWeight: active ? 700 : 400,
      };
    },
    savePlusBtn: { fontSize: 11, padding: '3px 10px', borderRadius: 100, border: '0.5px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#888', cursor: 'pointer', flexShrink: 0 } as React.CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 } as React.CSSProperties,
    pad: (idx: number): React.CSSProperties => {
      const isHeld = heldPads.has(idx) || activeChordPads.has(idx);
      const isAnchor = idx === anchorIdx;
      const isChordActive = activeChordPads.has(idx) && idx !== anchorIdx;
      const isChordMember = padChordMap.has(idx) && !activeChordPads.has(idx);
      let boxShadow = 'none';
      if (isAnchor) boxShadow = '0 0 0 3px rgba(255,255,255,.9), 0 0 14px 3px rgba(255,255,255,.2)';
      else if (isChordActive) boxShadow = '0 0 0 3px rgba(255,255,255,.85), 0 0 10px 2px rgba(255,255,255,.18)';
      else if (isChordMember) boxShadow = '0 0 0 2.5px rgba(255,255,255,.45)';
      return {
        height: 80, borderRadius: 10, border: '1.5px solid transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, cursor: 'pointer', userSelect: 'none', touchAction: 'none', position: 'relative',
        background: padBg, borderColor: padBg,
        filter: isHeld ? 'brightness(1.22)' : 'none',
        transform: isHeld ? 'scale(0.95)' : 'none',
        boxShadow,
        transition: 'background .5s ease, border-color .5s ease, box-shadow .15s ease',
      };
    },
    padKey:  { position: 'absolute' as const, top: 5, left: 7, fontSize: 10, fontWeight: 500, opacity: .5, color: padTx },
    padNote: { fontSize: 14, fontWeight: 'bold' as const, color: padTx },
    padRole: { fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase' as const, opacity: .55, color: padTx },
    chordBadge: (visible: boolean, chord: ChordResult): React.CSSProperties => {
      const cc = CHORD_COLORS[chord.type] || { bg: '#444', tx: '#fff' };
      return {
        position: 'absolute', bottom: 4, right: 4, fontSize: 9, fontWeight: 'bold',
        padding: '1px 4px', borderRadius: 3, pointerEvents: 'none',
        background: cc.bg, color: cc.tx, opacity: visible ? 1 : 0,
        transition: 'opacity .15s', whiteSpace: 'nowrap',
      };
    },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 },
    stat: { background: '#242424', borderRadius: 7, padding: '6px 8px', border: '0.5px solid rgba(255,255,255,0.1)' },
    statLbl: { fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: '.05em', color: '#555', marginBottom: 2 },
    statVal: { fontSize: 12, fontWeight: 500, color: '#ddd', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
    wsStatus: { fontSize: 10, color: wsStatus === 'connected' ? '#40a060' : '#505060', marginBottom: 6 },
  };

  return (
    <div style={{ background: '#1a1a1a', minHeight: '100%', color: '#e8e8e8', overflowY: 'auto' }}>
      <div style={s.wrap}>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#555', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
          valence beat pad
        </div>

        {/* Audience sync + valence slider */}
        <div style={s.controlRow}>
          <span style={s.lbl}>user sync</span>
          <div style={s.pillToggle}>
            <button style={s.pillBtn(!audienceSync)} onClick={() => setAudienceSync(false)}>off</button>
            <button style={s.pillBtn(audienceSync)}  onClick={() => setAudienceSync(true)}>on</button>
          </div>
          <span style={s.audienceCount}>
            audience: <span style={{ color: '#888', fontWeight: 600 }}>{audienceCount}</span>
          </span>
        </div>

        <div style={s.controlRow}>
          <span style={s.lbl}>Neg</span>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={0} max={100} value={valence} step={1}
              disabled={audienceSync || oscActive}
              style={{ ...s.slider, flex: 1, opacity: (audienceSync || oscActive) ? 0.5 : 1, cursor: (audienceSync || oscActive) ? 'not-allowed' : 'pointer' }}
              onChange={e => {
                if (audienceSync || oscActive) return;
                const v = parseInt(e.target.value);
                valenceRef.current = v;
                setValence(v);
              }}
            />
            {anchorIdx !== null && lockedValenceRef.current !== null && (
              <div style={{
                position: 'absolute',
                left: `${lockedValenceRef.current}%`,
                transform: 'translateX(-50%)',
                width: 3, height: 14,
                background: 'rgba(255,255,255,0.5)',
                borderRadius: 2,
                pointerEvents: 'none',
              }} />
            )}
          </div>
          <span style={s.lbl}>Pos</span>
        </div>

        {/* Oscillator — disabled when audience sync is on */}
        <div style={{ ...s.controlRow, opacity: audienceSync ? 0.4 : 1, pointerEvents: audienceSync ? 'none' : 'auto' }}>
          <button style={s.oscBtn(oscActive)} onClick={toggleOsc}>oscillate</button>
          <span style={s.lbl}>speed</span>
          <input
            type="range" min={0} max={100} value={oscSpeed} step={1} style={s.slider}
            onChange={e => { setOscSpeed(parseInt(e.target.value)); }}
          />
          <span style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap' as const }}>
            {formatPeriod(getPeriodMs(oscSpeed))}
          </span>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          {[['scale', getScaleLabel(padT)], ['timbre', getTimbreLabel(padT)], ['reverb', getReverbLabel(padT)]].map(([lbl, val]) => (
            <div key={lbl} style={s.stat}>
              <div style={s.statLbl}>{lbl}</div>
              <div style={s.statVal}>{val}</div>
            </div>
          ))}
        </div>

        {/* Chord chips strip — always rendered at fixed height to prevent layout jump */}
        <div style={s.chordStrip}>
          {frozenChords.map((chord, i) => (
            <button
              key={i}
              style={s.chordChip(activeChordNum === i + 1, chord)}
              onPointerDown={e => { e.stopPropagation(); selectChord(i + 1); }}
            >
              {i + 1}·{chord.name}
            </button>
          ))}
          {heldOrderRef.current.length >= 2 && frozenChords.length < 6 && (
            <button style={s.savePlusBtn} onPointerDown={e => { e.stopPropagation(); saveManualChord(); }}>
              + save
            </button>
          )}
        </div>

        {/* Pad grid */}
        <div style={s.grid}>
          {Array.from({ length: 16 }, (_, i) => {
            const badgeInfo = padChordMap.get(i);
            return (
              <div
                key={i}
                style={s.pad(i)}
                onPointerDown={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); padDown(i); }}
                onPointerUp={() => padUp(i)}
                onPointerCancel={() => padUp(i)}
              >
                <span style={s.padKey}>{KEY_LABELS[i]}</span>
                <span style={s.padNote}>{NAMES[sc][i]}</span>
                <span style={s.padRole}>{ROLES[i]}</span>
                {badgeInfo && (
                  <span style={s.chordBadge(true, badgeInfo.chord)}>
                    {badgeInfo.num} {badgeInfo.chord.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {wsStatus !== 'connected' && (
          <div style={s.wsStatus}>
            {wsStatus === 'connecting' ? 'connecting…' : 'not connected'}
          </div>
        )}
      </div>
    </div>
  );
}
