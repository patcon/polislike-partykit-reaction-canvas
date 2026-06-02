import { useState, useRef, useEffect } from "react";
import usePartySocket from 'partysocket/react';
import { usePanelContext } from "../../../context/PanelContext";
import { getPartySocketConfig } from '../../../utils/partyHost';
import { generateUUID } from '../../../utils/userId';

// Adapted from https://patcon.github.io/thx-deep-note/thx-2021-js1024.html (Joe Maffei, JS1024 2021)
// Partial levels from a cello sample (divided by 1000 when used)
const PARTIAL_LEVELS = Float32Array.of(0, 500, 331, 52, 83, 8, 4, 30, 28, 23, 9, 4, 3, 8, 5, 6);
// Harmonic multipliers — target D-major chord across 4 octaves
const MULTIPLIERS = Float32Array.of(1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 4, 4, 6, 6, 8, 8, 8, 12, 12, 12, 16, 16, 16, 24, 24, 24, 32, 32, 40);
const BASE_FREQ = 37.5;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Voice { osc: OscillatorNode; initFreq: number; finalFreq: number }

export default function ArrivalCanvasPanel() {
  const { room } = usePanelContext();
  const [presenceCount, setPresenceCount] = useState(0);
  const [capacity, setCapacity] = useState(50);

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const voicesRef    = useRef<Voice[]>([]);
  const socketUserId = useRef(generateUUID());

  // Build oscillators once on mount
  useEffect(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterGainRef.current = master;

    const voices: Voice[] = [];
    MULTIPLIERS.forEach((multiplier) => {
      const phase = Math.random() * 45;
      const real = PARTIAL_LEVELS.map((v, i) => -v / 1e3 * Math.sin(phase * i));
      const imag = PARTIAL_LEVELS.map((v, i) =>  v / 1e3 * Math.cos(phase * i));
      const wave = ctx.createPeriodicWave(real, imag);

      const initFreq  = 200 + Math.random() * 100;
      const finalFreq = BASE_FREQ * multiplier * (1 + Math.random() * 0.02);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const panner = ctx.createStereoPanner();

      osc.frequency.value = initFreq;
      osc.setPeriodicWave(wave);
      oscGain.gain.value = 1 / MULTIPLIERS.length;
      lfo.frequency.value = Math.random() * 2;
      lfoGain.gain.value = 0; // LFO has no gain until audio starts to avoid initial noise

      master.connect(lfoGain);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(oscGain);
      oscGain.connect(panner);
      panner.pan.value = 1 - Math.random() * 2;
      panner.connect(master);

      lfo.start();
      osc.start();
      voices.push({ osc, initFreq, finalFreq });
    });
    voicesRef.current = voices;

    return () => {
      voices.forEach(v => { try { v.osc.stop(); } catch {} });
      ctx.close();
    };
  }, []);

  // Update audio and visuals whenever fill ratio changes
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const fill = capacity > 0 ? Math.min(presenceCount / capacity, 1) : 0;

    if (fill > 0 && ctx.state === 'suspended') ctx.resume();

    voicesRef.current.forEach(({ osc, initFreq, finalFreq }) => {
      const target = lerp(initFreq, finalFreq, fill);
      osc.frequency.setTargetAtTime(target, ctx.currentTime, 1.0);
    });
    master.gain.setTargetAtTime(fill * 0.75, ctx.currentTime, 0.5);
  }, [presenceCount, capacity]);

  usePartySocket({
    ...getPartySocketConfig(),
    room,
    query: { isAdmin: 'true', userId: socketUserId.current },
    onMessage(evt) {
      let data: { type: string; count?: number; capacity?: number; arrivalCapacity?: number };
      try { data = JSON.parse(evt.data as string); } catch { return; }
      if (data.type === 'presenceCount' && data.count !== undefined) {
        setPresenceCount(data.count);
      } else if (data.type === 'arrivalCapacityChanged' && data.capacity !== undefined) {
        setCapacity(data.capacity);
      } else if (data.type === 'connected' && data.arrivalCapacity !== undefined) {
        setCapacity(data.arrivalCapacity);
      }
    },
  });

  const fillRatio = capacity > 0 ? Math.min(presenceCount / capacity, 1) : 0;
  const brightness = Math.round(fillRatio * 255);
  const bgColor = `rgb(${brightness},${brightness},${brightness})`;
  const textColor = fillRatio >= 0.5 ? '#000000' : '#ffffff';

  return (
    <div style={{
      position: 'absolute', inset: 0, background: bgColor,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.8s ease',
    }}>
      <div style={{
        fontSize: 'clamp(3rem,20vw,10rem)', fontWeight: 700, color: textColor,
        fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.04em',
        transition: 'color 0.4s',
      }}>
        {presenceCount}
      </div>
      <div style={{
        fontSize: 'clamp(1rem,5vw,2.5rem)', color: textColor, opacity: 0.5,
        fontFamily: 'monospace', marginTop: '0.4em',
        transition: 'color 0.4s',
      }}>
        / {capacity}
      </div>
    </div>
  );
}
