import { useState, useRef, useEffect } from "react";
import usePartySocket from 'partysocket/react';
import { usePanelContext } from "../../app/context/PanelContext";
import { getPartySocketConfig } from '../../app/utils/partyHost';
import { generateUUID } from '../../app/utils/userId';

// Adapted from https://patcon.github.io/thx-deep-note/thx-2021-js1024.html (Joe Maffei, JS1024 2021)
// Partial levels from a cello sample (divided by 1000 when used)
const PARTIAL_LEVELS = Float32Array.of(0, 500, 331, 52, 83, 8, 4, 30, 28, 23, 9, 4, 3, 8, 5, 6);
// Harmonic multipliers — target D-major chord across 4 octaves
const MULTIPLIERS = Float32Array.of(1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 4, 4, 6, 6, 8, 8, 8, 12, 12, 12, 16, 16, 16, 24, 24, 24, 32, 32, 40);
const BASE_FREQ = 37.5;
const SUSTAIN_MS = 1000;
const FADE_OUT_S = 3;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

interface Voice { osc: OscillatorNode; initFreq: number; finalFreq: number }

export default function ArrivalCanvasPanel() {
  const { room } = usePanelContext();
  const [presenceCount, setPresenceCount] = useState(0);
  const [capacity, setCapacity] = useState(50);
  const [fadingOut, setFadingOut] = useState(false);

  const audioCtxRef   = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const voicesRef     = useRef<Voice[]>([]);
  const socketUserId  = useRef(generateUUID());
  const fadingOutRef  = useRef(false);

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
      lfoGain.gain.value = 0;

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

  // Update audio whenever fill ratio changes
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master || fadingOutRef.current) return;

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
      let data: { type: string; count?: number; capacity?: number };
      try { data = JSON.parse(evt.data as string); } catch { return; }
      if (data.type === 'presenceCount' && data.count !== undefined) {
        setPresenceCount(data.count);
      } else if (data.type === 'arrivalCapacityChanged' && data.capacity !== undefined) {
        setCapacity(data.capacity);
      }
    },
  });

  // Trigger fade-out once capacity is reached
  useEffect(() => {
    if (presenceCount < capacity || capacity === 0 || fadingOutRef.current) return;

    fadingOutRef.current = true;
    const timer = setTimeout(() => {
      setFadingOut(true);
      const ctx = audioCtxRef.current;
      const master = masterGainRef.current;
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_OUT_S);
      }
    }, SUSTAIN_MS);

    return () => clearTimeout(timer);
  }, [presenceCount, capacity]);

  const fillRatio = capacity > 0 ? Math.min(presenceCount / capacity, 1) : 0;
  const brightness = Math.round(fillRatio * 255);
  const bgColor = `rgb(${brightness},${brightness},${brightness})`;
  const textColor = fadingOut ? '#ffffff' : (fillRatio >= 0.5 ? '#000000' : '#ffffff');
  const textTransition = fadingOut ? `color ${FADE_OUT_S}s ease` : 'color 0.4s';

  return (
    <div style={{
      flex: 1, background: bgColor,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transition: 'background 0.8s ease',
    }}>
      <div style={{
        fontSize: 'clamp(3rem,20vw,10rem)', fontWeight: 700, color: textColor,
        fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.04em',
        transition: textTransition,
      }}>
        {presenceCount}
      </div>
      <div style={{
        fontSize: 'clamp(1rem,5vw,2.5rem)', color: textColor, opacity: 0.5,
        fontFamily: 'monospace', marginTop: '0.4em',
        transition: textTransition,
      }}>
        / {capacity}
      </div>
    </div>
  );
}
