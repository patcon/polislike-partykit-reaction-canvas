import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────

interface Waypoint {
  t: number;
  chord: number[];
  velocity: number;
  tempo: number;
  pitchBend: number;
  oscType: string;
  octShift: number;
  emoji: string;
  chordName: string;
  color: [number, number, number];
  explain: string;
}

interface Preset {
  id: string;
  emoji: string;
  label: string;
  sliderGradient: string;
  waypoints: Waypoint[];
}

interface WaypointInterp {
  chordLo: number[];
  chordHi: number[];
  chordBlend: number;
  chord: number[];
  velocity: number;
  tempo: number;
  pitchBend: number;
  oscTypeA: string;
  oscTypeB: string;
  oscBlend: number;
  evilAmount: number;
  octShift: number;
  chordName: string;
  emoji: string;
  color: [number, number, number];
  explain: string;
}

// ── Data ──────────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const PRESETS: Preset[] = [
  {
    id: 'sad-happy',
    emoji: '😢→😄',
    label: 'sad → happy',
    sliderGradient: 'linear-gradient(to right, #4466bb, #e8a030)',
    waypoints: [
      { t: 0,   chord: [48,51,55,60], velocity: 38,  tempo: 640, pitchBend: -0.35, oscType: 'triangle', octShift: 0,
        emoji: '😢', chordName: 'C min', color: [60,100,200],
        explain: 'C minor, hushed (vel 38), slow (640ms). Pitch bent flat.' },
      { t: 0.5, chord: [48,51,55,60], velocity: 72,  tempo: 430, pitchBend: 0,     oscType: 'triangle', octShift: 0,
        emoji: '😐', chordName: 'C min', color: [130,130,160],
        explain: 'Midpoint — still minor but warming up, tempo picking up.' },
      { t: 1,   chord: [48,52,55,60], velocity: 112, tempo: 270, pitchBend:  0.35, oscType: 'triangle', octShift: 0,
        emoji: '😄', chordName: 'C maj', color: [220,160,40],
        explain: 'C major, bright (vel 112), fast (270ms). Pitch bent sharp.' },
    ],
  },
  {
    id: 'angry-happy',
    emoji: '😡→😄',
    label: 'angry → happy',
    sliderGradient: 'linear-gradient(to right, #cc3030, #e8a030)',
    waypoints: [
      { t: 0,    chord: [36,39,43,48], velocity: 82,  tempo: 240, pitchBend: 0,   oscType: 'angry',    octShift: 0,
        emoji: '😡', chordName: 'C dim', color: [200,40,40],
        explain: 'Detuned unison + noise FM + inharmonic modulator. Evil via instability, not volume.' },
      { t: 0.35, chord: [43,46,50,55], velocity: 74,  tempo: 360, pitchBend: 0,   oscType: 'angry',    octShift: 0,
        emoji: '😤', chordName: 'G min', color: [160,90,60],
        explain: 'Anger easing — still detuned and unstable, but opening up.' },
      { t: 0.55, chord: [43,46,50,55], velocity: 64,  tempo: 430, pitchBend: 0,   oscType: 'triangle', octShift: 0,
        emoji: '😐', chordName: 'G min', color: [130,110,130],
        explain: 'Same chord, instability fading — evil drains without a pitch jump.' },
      { t: 0.75, chord: [45,48,52,57], velocity: 72,  tempo: 370, pitchBend: 0.1, oscType: 'triangle', octShift: 0,
        emoji: '🙂', chordName: 'A min', color: [160,130,80],
        explain: 'A minor now — chord moves only after instability is already gone.' },
      { t: 1,    chord: [48,52,55,60], velocity: 108, tempo: 290, pitchBend: 0.3, oscType: 'triangle', octShift: 0,
        emoji: '😄', chordName: 'C maj', color: [220,160,40],
        explain: 'C major, bright and fast. Anger fully resolved into joy.' },
    ],
  },
  {
    id: 'tense-serene',
    emoji: '😰→😌',
    label: 'tense → serene',
    sliderGradient: 'linear-gradient(to right, #8833aa, #30aa88)',
    waypoints: [
      { t: 0,    chord: [48,53,56,62], velocity: 95, tempo: 220, pitchBend:  0.5,  oscType: 'sawtooth', octShift: 0,
        emoji: '😰', chordName: 'C sus4♭7', color: [160,40,200],
        explain: 'Suspended dissonant cluster, fast and tense. Pitch bent high.' },
      { t: 0.35, chord: [48,51,55,58], velocity: 72, tempo: 400, pitchBend:  0.2,  oscType: 'triangle', octShift: 0,
        emoji: '😟', chordName: 'C min7', color: [130,70,160],
        explain: 'Minor 7th — still unsettled but the urgency is easing.' },
      { t: 0.65, chord: [48,52,55,59], velocity: 52, tempo: 560, pitchBend:  0,    oscType: 'triangle', octShift: 0,
        emoji: '🙂', chordName: 'Cmaj7', color: [60,150,130],
        explain: 'Major 7th — warm, floating. Tension mostly released.' },
      { t: 1,    chord: [48,52,55,60], velocity: 36, tempo: 800, pitchBend: -0.1,  oscType: 'triangle', octShift: 0,
        emoji: '😌', chordName: 'C maj', color: [40,180,140],
        explain: 'Pure sine tone, very soft (vel 36), slow (800ms). Total serenity.' },
    ],
  },
  {
    id: 'eerie-wonder',
    emoji: '👻→🤩',
    label: 'eerie → wonder',
    sliderGradient: 'linear-gradient(to right, #224466, #aa6600)',
    waypoints: [
      { t: 0,   chord: [42,45,48,54], velocity: 44,  tempo: 700, pitchBend: -0.2,  oscType: 'sawtooth', octShift: 0,
        emoji: '👻', chordName: 'F# dim', color: [40,80,130],
        explain: 'F# diminished — unsettling, sparse, low velocity. Slow and hollow.' },
      { t: 0.5, chord: [48,51,55,62], velocity: 65,  tempo: 450, pitchBend:  0.15, oscType: 'triangle', octShift: 0,
        emoji: '😮', chordName: 'C min9', color: [100,100,160],
        explain: 'Minor 9 chord — mysterious but opening up. Something approaching.' },
      { t: 1,   chord: [48,52,55,64], velocity: 100, tempo: 260, pitchBend:  0.4,  oscType: 'triangle', octShift: 1,
        emoji: '🤩', chordName: 'C maj9', color: [200,140,30],
        explain: 'Major 9, bright velocity, fast — full revelation. Octave up.' },
    ],
  },
];

// ── Pure helpers ──────────────────────────────────────────────────

function noteName(n: number): string {
  return NOTE_NAMES[n % 12] + Math.floor(n / 12 - 1);
}
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
function midiToFreq(note: number, bendSemitones: number): number {
  return 440 * Math.pow(2, (note - 69 + bendSemitones) / 12);
}

const ANCHORS = {
  positive: { x: 95, y: 5  },
  negative: { x: 5,  y: 95 },
  neutral:  { x: 95, y: 95 },
};

function computeRegion(nx: number, ny: number): string {
  const x = nx / 100, y = ny / 100;
  const pos = { x: ANCHORS.positive.x / 100, y: ANCHORS.positive.y / 100 };
  const neg = { x: ANCHORS.negative.x / 100, y: ANCHORS.negative.y / 100 };
  const neu = { x: ANCHORS.neutral.x  / 100, y: ANCHORS.neutral.y  / 100 };
  const denom = (neg.y - neu.y) * (pos.x - neu.x) + (neu.x - neg.x) * (pos.y - neu.y);
  if (Math.abs(denom) < 1e-10) {
    const dp = Math.hypot(x - pos.x, y - pos.y);
    const dn = Math.hypot(x - neg.x, y - neg.y);
    const dz = Math.hypot(x - neu.x, y - neu.y);
    const m  = Math.min(dp, dn, dz);
    if (m === dp) return 'positive';
    if (m === dn) return 'negative';
    return 'neutral';
  }
  const wPos = ((neg.y - neu.y) * (x - neu.x) + (neu.x - neg.x) * (y - neu.y)) / denom;
  const wNeg = ((neu.y - pos.y) * (x - neu.x) + (pos.x - neu.x) * (y - neu.y)) / denom;
  const wNeu = 1 - wPos - wNeg;
  const mx = Math.max(wPos, wNeg, wNeu);
  if (mx === wPos) return 'positive';
  if (mx === wNeg) return 'negative';
  return 'neutral';
}

function cursorMoodValue(nx: number, ny: number): number {
  const x = nx / 100, y = ny / 100;
  const pos = { x: ANCHORS.positive.x / 100, y: ANCHORS.positive.y / 100 };
  const neg = { x: ANCHORS.negative.x / 100, y: ANCHORS.negative.y / 100 };
  const neu = { x: ANCHORS.neutral.x  / 100, y: ANCHORS.neutral.y  / 100 };
  const denom = (neg.y - neu.y) * (pos.x - neu.x) + (neu.x - neg.x) * (pos.y - neu.y);
  if (Math.abs(denom) < 1e-10) {
    const dp = Math.hypot(x - pos.x, y - pos.y) || 1e-9;
    const dn = Math.hypot(x - neg.x, y - neg.y) || 1e-9;
    const dz = Math.hypot(x - neu.x, y - neu.y) || 1e-9;
    const invSum = 1/dp + 1/dn + 1/dz;
    const wPos = (1/dp) / invSum;
    const wNeg = (1/dn) / invSum;
    const wNeu = 1 - wPos - wNeg;
    return clamp(wPos * 100 + wNeg * 0 + wNeu * 50, 0, 100);
  }
  const wPos = ((neg.y - neu.y) * (x - neu.x) + (neu.x - neg.x) * (y - neu.y)) / denom;
  const wNeg = ((neu.y - pos.y) * (x - neu.x) + (pos.x - neu.x) * (y - neu.y)) / denom;
  const wNeu = 1 - wPos - wNeg;
  return clamp(wPos * 100 + wNeg * 0 + wNeu * 50, 0, 100);
}

function interpolateWaypoints(preset: Preset, t: number): WaypointInterp {
  const wps = preset.waypoints;
  let lo = wps[0], hi = wps[wps.length - 1];
  for (let i = 0; i < wps.length - 1; i++) {
    if (t >= wps[i].t && t <= wps[i + 1].t) { lo = wps[i]; hi = wps[i + 1]; break; }
  }
  const span = hi.t - lo.t || 1;
  const f = clamp((t - lo.t) / span, 0, 1);
  const nearest = f < 0.5 ? lo : hi;
  const loEvil = lo.oscType === 'angry' ? 1 : 0;
  const hiEvil = hi.oscType === 'angry' ? 1 : 0;
  const chordsMatch = JSON.stringify(lo.chord) === JSON.stringify(hi.chord);
  return {
    chordLo:    lo.chord,
    chordHi:    hi.chord,
    chordBlend: chordsMatch ? 0 : f,
    chord:      nearest.chord,
    velocity:   Math.round(lerp(lo.velocity, hi.velocity, f)),
    tempo:      Math.round(lerp(lo.tempo, hi.tempo, f)),
    pitchBend:  lerp(lo.pitchBend, hi.pitchBend, f),
    oscTypeA:   lo.oscType === 'angry' ? 'triangle' : lo.oscType,
    oscTypeB:   hi.oscType === 'angry' ? 'triangle' : hi.oscType,
    oscBlend:   lo.oscType === hi.oscType ? 0 : f,
    evilAmount: lerp(loEvil, hiEvil, f),
    octShift:   nearest.octShift,
    chordName:  nearest.chordName,
    emoji:      nearest.emoji,
    color:      lo.color.map((c, i) => Math.round(lerp(c, hi.color[i], f))) as [number,number,number],
    explain:    nearest.explain,
  };
}

// ── Audio gain per oscillator type ────────────────────────────────
const OSC_GAIN: Record<string, number> = { sawtooth: 0.10, square: 0.15, triangle: 0.32, sine: 0.55 };

// ── WebSocket URL ─────────────────────────────────────────────────
const DEFAULT_HOST = 'polislike-partykit-reaction-canvas.patcon.partykit.dev';

function makeWsUrl(room: string): string {
  const isLocal = window.location.port === '1999';
  const host = isLocal ? `${window.location.hostname}:1999` : DEFAULT_HOST;
  const proto = isLocal ? 'ws' : 'wss';
  const uid = typeof crypto !== 'undefined' && (crypto as { randomUUID?: () => string }).randomUUID
    ? (crypto as { randomUUID: () => string }).randomUUID()
    : Math.random().toString(36).slice(2);
  return `${proto}://${host}/parties/main/${encodeURIComponent(room)}?isAdmin=true&userId=${uid}`;
}

// ── Component ─────────────────────────────────────────────────────

interface BarState { height: number; color: [number,number,number]; active: boolean; }

const RESET_BARS: BarState[] = [0,1,2,3].map(() => ({ height: 3, color: [42,42,64], active: false }));

export default function MoodTonesPanel({ room }: { room: string }) {
  const [activePreset, setActivePreset]   = useState<Preset>(PRESETS[0]);
  const [playing, setPlaying]             = useState(false);
  const [mood, setMood]                   = useState(0);
  const [audienceSync, setAudienceSync]   = useState(true);
  const [valenceMode, setValenceMode]     = useState<'continuous'|'unit'>('continuous');
  const [volume, setVolume]               = useState(100);
  const [currentChord, setCurrentChord]   = useState<number[]>([]);
  const [litNote, setLitNote]             = useState<number|null>(null);
  const [bars, setBars]                   = useState<BarState[]>(RESET_BARS);
  const [wsStatus, setWsStatus]           = useState<'disconnected'|'connecting'|'connected'>('disconnected');
  const [audienceCount, setAudienceCount] = useState(0);
  const [displayInfo, setDisplayInfo]     = useState({ emoji: PRESETS[0].waypoints[0].emoji, chordName: '—', velocity: '—', tempo: '—', octave: '—', explain: 'Select a preset and drag the slider.' });

  // Audio refs
  const audioCtxRef   = useRef<AudioContext|null>(null);
  const masterBusRef  = useRef<DynamicsCompressorNode|null>(null);
  const volumeNodeRef = useRef<GainNode|null>(null);
  const schedTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Loop-state refs (avoid stale closures in setTimeout tick)
  const moodRef         = useRef(0);
  const playingRef      = useRef(false);
  const presetRef       = useRef<Preset>(PRESETS[0]);
  const noteIndexRef    = useRef(0);
  const currentChordRef = useRef<number[]>([]);

  // WS refs
  const wsRef           = useRef<WebSocket|null>(null);
  const cursorsRef      = useRef<Map<string,{x:number;y:number;region:string}>>(new Map());
  const cursorRegionsRef= useRef<Map<string,string>>(new Map());
  const audienceSyncRef = useRef(true);
  const valenceModeRef  = useRef<'continuous'|'unit'>('continuous');

  // Keep refs in sync with state
  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { presetRef.current = activePreset; }, [activePreset]);
  useEffect(() => { audienceSyncRef.current = audienceSync; }, [audienceSync]);
  useEffect(() => { valenceModeRef.current = valenceMode; }, [valenceMode]);

  // Volume change → update live gain node
  useEffect(() => {
    if (volumeNodeRef.current) volumeNodeRef.current.gain.value = volume / 100;
  }, [volume]);

  // ── Audience mood ──────────────────────────────────────────────
  const applyAudienceMood = useCallback(() => {
    if (!audienceSyncRef.current) return;
    const cursors = cursorsRef.current;
    if (cursors.size === 0) return;
    let val: number;
    if (valenceModeRef.current === 'continuous') {
      let sum = 0;
      for (const [, c] of cursors) sum += cursorMoodValue(c.x, c.y);
      val = sum / cursors.size;
    } else {
      let sum = 0;
      for (const [, c] of cursors) {
        if (c.region === 'positive') sum += 1;
        else if (c.region === 'negative') sum += -1;
      }
      val = (sum / cursors.size + 1) / 2 * 100;
    }
    const clamped = Math.round(clamp(val, 0, 100));
    moodRef.current = clamped;
    setMood(clamped);
  }, []);

  useEffect(() => {
    if (audienceSync) applyAudienceMood();
  }, [audienceSync, valenceMode, applyAudienceMood]);

  // ── WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>|null = null;
    let dead = false;

    function connect() {
      if (dead) return;
      setWsStatus('connecting');
      const socket = new WebSocket(makeWsUrl(room));
      wsRef.current = socket;

      socket.onopen = () => { if (!dead) setWsStatus('connected'); };

      socket.onmessage = (evt) => {
        if (dead) return;
        let data: { type: string; position?: { userId: string; x: number; y: number } };
        try { data = JSON.parse(evt.data as string); } catch { return; }
        if (data.type === 'move' || data.type === 'touch') {
          const { userId, x, y } = data.position!;
          const region = computeRegion(x, y);
          const prevRegion = cursorRegionsRef.current.get(userId);
          cursorsRef.current.set(userId, { x, y, region });
          if (valenceModeRef.current === 'continuous' || region !== prevRegion) {
            cursorRegionsRef.current.set(userId, region);
            setAudienceCount(cursorsRef.current.size);
            applyAudienceMood();
          }
        } else if (data.type === 'remove') {
          const { userId } = data.position!;
          cursorsRef.current.delete(userId);
          cursorRegionsRef.current.delete(userId);
          setAudienceCount(cursorsRef.current.size);
          applyAudienceMood();
        }
      };

      socket.onerror = () => { if (!dead) setWsStatus('disconnected'); };

      socket.onclose = () => {
        if (dead) return;
        setWsStatus('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      dead = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [room, applyAudienceMood]);

  // ── Audio helpers ──────────────────────────────────────────────
  function makeSawFilter(freq: number, vel: number): BiquadFilterNode {
    const ctx = audioCtxRef.current!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = clamp(freq * (1.2 + (vel / 127) * 2.5), 200, 3200);
    f.Q.value = 0.8;
    return f;
  }

  function playAngryTone(freq: number, vel: number, durMs: number, evilAmount: number) {
    const ctx = audioCtxRef.current; const bus = masterBusRef.current;
    if (!ctx || !bus) return;
    const evil = clamp(evilAmount, 0, 1);
    if (evil < 0.001) return;
    const velNorm  = clamp(vel / 127, 0, 1);
    const amp      = 0.07 * velNorm * evil;
    const durSec   = durMs / 1000;
    const now      = ctx.currentTime;
    const end      = now + durSec;
    const sustainEnd = now + durSec * 0.72;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(amp, 0.0001), now + 0.01);
    masterGain.gain.setValueAtTime(amp, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, sustainEnd);
    masterGain.connect(bus);
    const detuneCents = evil * 18;
    for (const detune of [-detuneCents, detuneCents]) {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq * Math.pow(2, detune / 1200);
      gain.gain.value = 0.45;
      osc.connect(gain); gain.connect(masterGain);
      osc.start(now); osc.stop(end);
    }
    if (evil > 0.05) {
      const lfoRate  = 1.8 + Math.random() * 1.2;
      const lfoDepth = evil * freq * 0.008;
      const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
      lfo.type = 'sine'; lfo.frequency.value = lfoRate; lfoGain.gain.value = lfoDepth;
      const modCarrier = ctx.createOscillator(); const modGain = ctx.createGain();
      modCarrier.type = 'triangle'; modCarrier.frequency.value = freq * 1.003;
      lfo.connect(lfoGain); lfoGain.connect(modCarrier.frequency);
      modGain.gain.value = 0.18 * evil;
      modCarrier.connect(modGain); modGain.connect(masterGain);
      lfo.start(now); lfo.stop(end); modCarrier.start(now); modCarrier.stop(end);
    }
    if (evil > 0.1) {
      const fmRatio = 2.13 + evil * 0.4;
      const fmDepth = evil * freq * 0.06;
      const fmMod = ctx.createOscillator(); const fmModGain = ctx.createGain();
      const fmCarrier = ctx.createOscillator(); const fmCarGain = ctx.createGain();
      fmMod.type = 'sine'; fmMod.frequency.value = freq * fmRatio; fmModGain.gain.value = fmDepth;
      fmCarrier.type = 'sine'; fmCarrier.frequency.value = freq; fmCarGain.gain.value = 0.22 * evil;
      fmMod.connect(fmModGain); fmModGain.connect(fmCarrier.frequency);
      fmCarrier.connect(fmCarGain); fmCarGain.connect(masterGain);
      fmMod.start(now); fmMod.stop(end); fmCarrier.start(now); fmCarrier.stop(end);
    }
  }

  function playTone(freq: number, vel: number, durMs: number, oscTypeA: string, oscTypeB: string, blend: number) {
    const ctx = audioCtxRef.current; const bus = masterBusRef.current;
    if (!ctx || !bus || vel < 0.5) return;
    const velNorm = vel / 127;
    const durSec  = durMs / 1000;
    const now     = ctx.currentTime;
    const end     = now + durSec;
    function makeOsc(type: string, gainScale: number) {
      if (gainScale < 0.005) return;
      const baseAmp = (OSC_GAIN[type] ?? 0.10) * velNorm * gainScale;
      const osc  = ctx!.createOscillator(); const gain = ctx!.createGain();
      osc.type = type as OscillatorType;
      osc.frequency.value = freq;
      if (type === 'sine' || type === 'triangle') {
        gain.gain.setValueAtTime(Math.max(baseAmp, 0.0001), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec * 0.92);
      } else {
        const attackEnd  = now + 0.008;
        const sustainEnd = now + durSec * 0.45;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(baseAmp, 0.0001), attackEnd);
        gain.gain.setValueAtTime(Math.max(baseAmp, 0.0001), attackEnd);
        gain.gain.exponentialRampToValueAtTime(0.0001, sustainEnd);
      }
      if (type === 'sawtooth') {
        const filter = makeSawFilter(freq, vel);
        osc.connect(filter); filter.connect(gain);
      } else {
        osc.connect(gain);
      }
      gain.connect(bus!);
      osc.start(now); osc.stop(end);
    }
    const b = clamp(blend || 0, 0, 1);
    makeOsc(oscTypeA, 1 - b);
    if (oscTypeB && oscTypeB !== oscTypeA && b > 0.01) makeOsc(oscTypeB, b);
  }

  // ── Tick loop ──────────────────────────────────────────────────
  // tickRef always points to the latest closure so setTimeout never goes stale
  const tickRef = useRef<() => void>(() => {});
  tickRef.current = () => {
    if (!playingRef.current) return;
    const t = moodRef.current / 100;
    const p = interpolateWaypoints(presetRef.current, t);

    const chordLo   = p.chordLo.map(n => n + p.octShift * 12);
    const chordHi   = p.chordHi.map(n => n + p.octShift * 12);
    const useHi     = Math.random() < p.chordBlend;
    const activeChord = useHi ? chordHi : chordLo;

    const displayChord = p.chordBlend > 0.5 ? chordHi : chordLo;
    if (JSON.stringify(displayChord) !== JSON.stringify(currentChordRef.current)) {
      currentChordRef.current = [...displayChord];
      setCurrentChord([...displayChord]);
      noteIndexRef.current = 0;
    }

    const idx  = noteIndexRef.current % activeChord.length;
    const note = activeChord[idx];
    noteIndexRef.current++;

    const freq = midiToFreq(note, p.pitchBend * 2);
    playAngryTone(freq, p.velocity, p.tempo * 0.8, p.evilAmount);
    playTone(freq, p.velocity * (1 - p.evilAmount), p.tempo * 0.8, p.oscTypeA, p.oscTypeB, p.oscBlend);

    setLitNote(note);
    const maxH = 52;
    setBars([0,1,2,3].map(i => ({
      height: i === idx % 4
        ? Math.round(lerp(16, maxH, p.velocity / 127))
        : Math.round(p.velocity / 127 * 14),
      color:  p.color,
      active: i === idx % 4,
    })));
    setDisplayInfo({
      emoji:     p.emoji,
      chordName: p.chordName,
      velocity:  String(p.velocity),
      tempo:     p.tempo + 'ms',
      octave:    p.octShift === 0 ? '±0' : (p.octShift > 0 ? '+' : '') + p.octShift,
      explain:   p.explain,
    });

    schedTimerRef.current = setTimeout(() => tickRef.current(), p.tempo);
  };

  // ── Start / stop ───────────────────────────────────────────────
  function startPlaying() {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const bus = ctx.createDynamicsCompressor();
      bus.threshold.value = -24; bus.knee.value = 10;
      bus.ratio.value = 8; bus.attack.value = 0.003; bus.release.value = 0.15;
      const makeup = ctx.createGain(); makeup.gain.value = 2.5;
      const vol = ctx.createGain(); vol.gain.value = volume / 100;
      bus.connect(makeup); makeup.connect(vol); vol.connect(ctx.destination);
      audioCtxRef.current = ctx; masterBusRef.current = bus; volumeNodeRef.current = vol;
    }
    if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume();
    playingRef.current = true;
    setPlaying(true);
    noteIndexRef.current = 0;
    tickRef.current();
  }

  function stopPlaying() {
    playingRef.current = false;
    setPlaying(false);
    if (schedTimerRef.current) clearTimeout(schedTimerRef.current);
    setLitNote(null);
    setBars(RESET_BARS);
  }

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      playingRef.current = false;
      if (schedTimerRef.current) clearTimeout(schedTimerRef.current);
      if (audioCtxRef.current) { void audioCtxRef.current.close(); audioCtxRef.current = null; }
    };
  }, []);

  // ── Preset selection ───────────────────────────────────────────
  function selectPreset(p: Preset) {
    setActivePreset(p);
    presetRef.current = p;
    if (!audienceSyncRef.current) {
      moodRef.current = 0;
      setMood(0);
    }
    noteIndexRef.current = 0;
    currentChordRef.current = [];
    setCurrentChord([]);
    const wp = p.waypoints;
    setDisplayInfo(prev => ({
      ...prev,
      emoji: wp[0].emoji,
      chordName: wp[0].chordName,
      explain: 'Drag the slider to change mood.',
    }));
  }

  // ── Inline styles ──────────────────────────────────────────────
  const s = {
    wrap: { padding: '1.25rem', maxWidth: 520, margin: '0 auto' } as React.CSSProperties,
    presets: { display: 'flex', gap: 6, marginBottom: '1.25rem', flexWrap: 'wrap' as const },
    presetBtn: (active: boolean): React.CSSProperties => ({
      flex: '1 1 100px', minWidth: 100,
      padding: '0.5rem 0.7rem', borderRadius: 10,
      border: `1px solid ${active ? '#5050a0' : '#2a2a3a'}`,
      background: active ? '#1e1e30' : '#141420',
      color: active ? '#c0c0ff' : '#7070a0',
      fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
      textAlign: 'center', lineHeight: 1.4,
    }),
    emojiDisplay: { textAlign: 'center' as const, fontSize: '2.2rem', marginBottom: '0.9rem', lineHeight: 1 },
    emojiRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.1rem' },
    emojiEnd: { fontSize: '1.4rem', flexShrink: 0 },
    sliderWrap: { flex: 1 },
    sliderLabels: { display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.68rem', color: '#505070' },
    range: { width: '100%' } as React.CSSProperties,
    syncRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: '0.9rem', marginBottom: '0.9rem', flexWrap: 'wrap' as const },
    toggleLabel: { fontSize: '0.68rem', color: '#505070', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    pillToggle: { display: 'flex', background: '#141420', border: '1px solid #2a2a3a', borderRadius: 20, overflow: 'hidden' },
    pillBtn: (active: boolean): React.CSSProperties => ({
      padding: '0.28rem 0.7rem', fontSize: '0.72rem', fontWeight: 500,
      border: 'none', background: active ? '#2a2a48' : 'transparent',
      color: active ? '#a0a0e0' : '#505070', cursor: 'pointer', borderRadius: 20,
    }),
    audienceCount: { fontSize: '0.7rem', color: '#505070', marginLeft: 'auto' },
    viz: { display: 'flex', alignItems: 'flex-end', gap: 5, height: 52, marginBottom: '1rem', padding: '0 2px' },
    chips: { display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: '1rem', minHeight: 24 },
    chip: (lit: boolean): React.CSSProperties => ({
      fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20,
      background: lit ? '#2a3860' : '#222230',
      color: lit ? '#90b0ff' : '#6060a0',
      border: `1px solid ${lit ? '#4060b0' : '#303050'}`,
      fontWeight: 500,
    }),
    stats: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: '1rem' },
    stat: { background: '#141420', borderRadius: 8, padding: '0.45rem 0.5rem', textAlign: 'center' as const },
    statLabel: { fontSize: '0.58rem', color: '#505070', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 3 },
    statValue: { fontSize: '0.85rem', fontWeight: 600, color: '#b0b0d0' },
    volumeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' },
    volumeLabel: { fontSize: '0.7rem', color: '#505070', width: '2.2rem', textAlign: 'right' as const, flexShrink: 0 },
    playBtn: (playing: boolean): React.CSSProperties => ({
      width: '100%', padding: '0.65rem', borderRadius: 10,
      border: `1px solid ${playing ? '#30a060' : '#3a3a50'}`,
      background: playing ? '#1a3020' : '#1a1a28',
      color: playing ? '#60e090' : '#b0b0d0',
      fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
    }),
    explain: { background: '#141420', border: '1px solid #1e1e32', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.78rem', color: '#6060a0', lineHeight: 1.65, minHeight: 40, marginTop: '0.75rem' },
    wsStatus: { fontSize: '0.68rem', color: wsStatus === 'connected' ? '#40a060' : wsStatus === 'connecting' ? '#6060a0' : '#606080', marginBottom: '0.75rem' },
  };

  const wp0 = activePreset.waypoints[0];
  const wpN = activePreset.waypoints[activePreset.waypoints.length - 1];

  return (
    <div style={{ background: '#0f0f13', minHeight: '100%', color: '#e8e8ec', fontFamily: 'system-ui, sans-serif', overflowY: 'auto' }}>
      <div style={s.wrap}>
        <div style={{ fontSize: '0.68rem', fontWeight: 500, color: '#606080', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          mood tones
        </div>

        <div style={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 16, padding: '1.25rem', marginBottom: '0.75rem' }}>

          {/* Presets */}
          <div style={s.presets}>
            {PRESETS.map(p => (
              <button key={p.id} style={s.presetBtn(activePreset.id === p.id)} onClick={() => selectPreset(p)}>
                <span style={{ fontSize: '1rem', display: 'block', marginBottom: 2 }}>{p.emoji}</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Big emoji */}
          <div style={s.emojiDisplay}>{displayInfo.emoji}</div>

          {/* Slider */}
          <div style={s.emojiRow}>
            <span style={s.emojiEnd}>{wp0.emoji}</span>
            <div style={s.sliderWrap}>
              <input
                type="range" min={0} max={100} value={mood} step={1}
                disabled={audienceSync}
                style={{ ...s.range, background: activePreset.sliderGradient, opacity: audienceSync ? 0.6 : 1, cursor: audienceSync ? 'not-allowed' : 'pointer' }}
                onChange={e => {
                  if (audienceSync) return;
                  const v = parseInt(e.target.value);
                  moodRef.current = v;
                  setMood(v);
                  setDisplayInfo(prev => {
                    const p = interpolateWaypoints(activePreset, v / 100);
                    return { ...prev, emoji: p.emoji, chordName: p.chordName, velocity: String(p.velocity), tempo: p.tempo + 'ms', octave: p.octShift === 0 ? '±0' : (p.octShift > 0 ? '+' : '') + p.octShift, explain: p.explain };
                  });
                }}
              />
              <div style={s.sliderLabels}>
                <span>{wp0.chordName.toLowerCase()}</span>
                <span>{wpN.chordName.toLowerCase()}</span>
              </div>
            </div>
            <span style={s.emojiEnd}>{wpN.emoji}</span>
          </div>

          {/* Audience sync */}
          <div style={s.syncRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={s.toggleLabel}>audience sync</span>
              <div style={s.pillToggle}>
                <button style={s.pillBtn(!audienceSync)} onClick={() => setAudienceSync(false)}>off</button>
                <button style={s.pillBtn(audienceSync)}  onClick={() => setAudienceSync(true)}>on</button>
              </div>
            </div>
            {audienceSync && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={s.toggleLabel}>valence</span>
                <div style={s.pillToggle}>
                  <button style={s.pillBtn(valenceMode === 'continuous')} onClick={() => setValenceMode('continuous')}>continuous</button>
                  <button style={s.pillBtn(valenceMode === 'unit')}       onClick={() => setValenceMode('unit')}>unit</button>
                </div>
              </div>
            )}
            {audienceSync && (
              <div style={s.audienceCount}>
                audience: <span style={{ color: '#8080b0', fontWeight: 600 }}>{audienceCount}</span>
              </div>
            )}
          </div>

          {/* Viz bars */}
          <div style={s.viz}>
            {bars.map((b, i) => (
              <div key={i} style={{
                flex: 1, borderRadius: '3px 3px 0 0', minHeight: 3,
                height: b.height,
                background: `rgb(${b.color[0]},${b.color[1]},${b.color[2]})`,
                opacity: b.active ? 1 : 0.35,
                transition: 'height 0.1s ease, background 0.35s ease',
              }} />
            ))}
          </div>

          {/* Note chips */}
          <div style={s.chips}>
            {currentChord.map(n => (
              <span key={n} style={s.chip(litNote === n)}>{noteName(n)}</span>
            ))}
          </div>

          {/* Stats */}
          <div style={s.stats}>
            {[['chord', displayInfo.chordName], ['velocity', displayInfo.velocity], ['tempo', displayInfo.tempo], ['octave', displayInfo.octave]].map(([label, value]) => (
              <div key={label} style={s.stat}>
                <div style={s.statLabel}>{label}</div>
                <div style={s.statValue}>{value}</div>
              </div>
            ))}
          </div>

          {/* Volume */}
          <div style={s.volumeRow}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>🔈</span>
            <input type="range" min={0} max={200} value={volume} step={1} style={{ flex: 1 }}
              onChange={e => setVolume(parseInt(e.target.value))} />
            <span style={s.volumeLabel}>{volume}%</span>
          </div>

          {/* Play button */}
          <button style={s.playBtn(playing)} onClick={playing ? stopPlaying : startPlaying}>
            {playing ? '■ stop' : '▶ start'}
          </button>
        </div>

        {/* WS status + explain */}
        <div style={s.wsStatus}>
          {wsStatus === 'connected' ? `connected · room: ${room} · ${audienceCount} participant${audienceCount !== 1 ? 's' : ''}` : wsStatus === 'connecting' ? 'connecting…' : 'not connected'}
        </div>
        <div style={s.explain}>{displayInfo.explain}</div>
      </div>
    </div>
  );
}
