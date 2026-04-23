import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { generateUUID } from "../utils/userId";

const CAM_MODES = ['static', 'lerp', 'exp', 'spring', 'quat'];

interface SceneActions {
  togglePlay: () => void;
  onVizModeChange: (mode: 'light' | 'particle') => void;
  onDofChange: (d: 1 | 2 | 3) => void;
  onAttractedChange: (a: boolean) => void;
  onPathModeChange: (mode: 'simple' | 'semantic') => void;
  onDotModeChange: (m: 'group' | 'valence') => void;
  onTrailModeChange: (m: 'group' | 'valence') => void;
  onFillModeChange: (m: 'group' | 'valence') => void;
  onFillAlphaChange: (v: number) => void;
  onRadiusChange: (v: number) => void;
  onSimCountChange: (n: number) => void;
  onCamModeChange: (mode: string) => void;
  onCamTargetChange: (mode: 'head' | 'trail') => void;
  connectWs: (room: string) => void;
  disconnectWs: () => void;
  isWsConnected: () => boolean;
  isWsConnecting: () => boolean;
  setScrubbing: (scrubbing: boolean) => void;
}

interface Person {
  gi: number;
  vals: Float32Array;
  isLive: boolean;
  liveUserId: string | null;
  simSlot: number;
  angle: number;
  dy: number;
  dx: number;
  ringAngle: number;
  orbitAngles: Float32Array;
  orbitAnglesAttracted?: Float32Array;
  chargedX?: Float32Array;
  chargedY?: Float32Array;
  chargedFX?: Float32Array;
  chargedFY?: Float32Array;
  ptsLight: Float32Array;
  colGroup: Float32Array;
  colVal: Float32Array;
}

export default function ValenceViz() {
  // ── UI State ───────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(true);
  const [vizMode, setVizMode] = useState<'light' | 'particle'>('light');
  const [dof, setDof] = useState<1 | 2 | 3>(1);
  const [attracted, setAttracted] = useState(false);
  const [pathMode, setPathMode] = useState<'simple' | 'semantic'>('simple');
  const [dotMode, setDotMode] = useState<'group' | 'valence'>('group');
  const [trailMode, setTrailMode] = useState<'group' | 'valence'>('group');
  const [fillMode, setFillMode] = useState<'group' | 'valence'>('group');
  const [simCount, setSimCount] = useState(100);
  const [camMode, setCamMode] = useState('static');
  const [camTargetMode, setCamTargetMode] = useState<'head' | 'trail'>('head');
  const [wsStatusText, setWsStatusText] = useState('not connected');
  const [wsStatusCls, setWsStatusCls] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [audienceVisible, setAudienceVisible] = useState(false);
  const [audienceN, setAudienceN] = useState(0);
  const [liveBadge, setLiveBadge] = useState(false);
  const [legGroup, setLegGroup] = useState(true);
  const [legVal, setLegVal] = useState(false);
  const [showDof, setShowDof] = useState(false);
  const [showAttract, setShowAttract] = useState(false);
  const [showRowParticle, setShowRowParticle] = useState(false);
  const [roomInputVal, setRoomInputVal] = useState(
    () => new URLSearchParams(window.location.search).get('room') || 'default'
  );

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const tdispRef = useRef<HTMLDivElement>(null);

  // ── Scene actions (set by useEffect) ──────────────────────────────────────
  const actionsRef = useRef<SceneActions | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;

    const canvas = canvasRef.current;
    const wrap = wrapRef.current;

    // ── Three.js renderer ──────────────────────────────────────────────────
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0x08080e, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.01, 100);

    // ── constants ──────────────────────────────────────────────────────────
    const LIVE_STEPS    = 1280;
    const HISTORY_STEPS = 320;
    const TOTAL_STEPS   = LIVE_STEPS + HISTORY_STEPS;
    const TOTAL         = 100;
    let MAX_R           = 0.22;
    let radiusScale     = 1.0;
    let DURATION        = 300;
    let tubeR           = 0.20;
    const TUBE_RANGE    = 0.18;

    // ── mutable mode state (local vars read by render loop) ────────────────
    let vizModeLocal: 'light' | 'particle' = 'light';
    let dofLocal: 1 | 2 | 3 = 1;
    let attractedLocal = false;
    let dotModeLocal: 'group' | 'valence' = 'group';
    let trailModeLocal: 'group' | 'valence' = 'group';
    let fillModeLocal: 'group' | 'valence' = 'group';
    let fillAlphaVal = 0.12;
    let simCountLocal = 100;

    // ── colors ─────────────────────────────────────────────────────────────
    const GROUP_COLS = [
      new THREE.Color(0x38bdf8),
      new THREE.Color(0xfbbf24),
      new THREE.Color(0xa78bfa),
    ];
    const C_AGREE    = new THREE.Color(0x00ff7f);
    const C_NEUTRAL  = new THREE.Color(0x1e293b);
    const C_DISAGREE = new THREE.Color(0xff2222);

    function valCol(v: number) {
      const c = new THREE.Color();
      if (v >= 0) c.lerpColors(C_NEUTRAL, C_AGREE, v);
      else        c.lerpColors(C_NEUTRAL, C_DISAGREE, -v);
      return c;
    }

    // ── bezier path ────────────────────────────────────────────────────────
    const BEZ = [
      new THREE.Vector3(-0.4,  0.15, -1.8),
      new THREE.Vector3( 0.5, -0.2,  -0.6),
      new THREE.Vector3(-0.3,  0.25,  0.6),
      new THREE.Vector3( 0.35,-0.1,   1.8),
    ];
    function bezPt(t: number) {
      const mt = 1 - t;
      return new THREE.Vector3(
        mt*mt*mt*BEZ[0].x+3*mt*mt*t*BEZ[1].x+3*mt*t*t*BEZ[2].x+t*t*t*BEZ[3].x,
        mt*mt*mt*BEZ[0].y+3*mt*mt*t*BEZ[1].y+3*mt*t*t*BEZ[2].y+t*t*t*BEZ[3].y,
        mt*mt*mt*BEZ[0].z+3*mt*mt*t*BEZ[1].z+3*mt*t*t*BEZ[2].z+t*t*t*BEZ[3].z,
      );
    }
    function bezTan(t: number) {
      const mt = 1 - t;
      return new THREE.Vector3(
        3*(mt*mt*(BEZ[1].x-BEZ[0].x)+2*mt*t*(BEZ[2].x-BEZ[1].x)+t*t*(BEZ[3].x-BEZ[2].x)),
        3*(mt*mt*(BEZ[1].y-BEZ[0].y)+2*mt*t*(BEZ[2].y-BEZ[1].y)+t*t*(BEZ[3].y-BEZ[2].y)),
        3*(mt*mt*(BEZ[1].z-BEZ[0].z)+2*mt*t*(BEZ[2].z-BEZ[1].z)+t*t*(BEZ[3].z-BEZ[2].z)),
      ).normalize();
    }

    const N_PATH = TOTAL_STEPS + 1;
    const pathPos: THREE.Vector3[] = [];
    const pathTan: THREE.Vector3[] = [];
    const pathNorm: THREE.Vector3[] = [];
    const pathBi: THREE.Vector3[] = [];

    function buildPathFrames(
      posFn: (t: number) => THREE.Vector3,
      tanFn: (t: number) => THREE.Vector3
    ) {
      pathPos.length = 0; pathTan.length = 0; pathNorm.length = 0; pathBi.length = 0;
      for (let i = 0; i < N_PATH; i++) {
        const t = i / (N_PATH - 1);
        pathPos.push(posFn(t)); pathTan.push(tanFn(t));
      }
      let up = new THREE.Vector3(0,1,0);
      if (Math.abs(pathTan[0].dot(up)) > 0.9) up.set(1,0,0);
      const b0 = new THREE.Vector3().crossVectors(pathTan[0], up).normalize();
      pathNorm.push(new THREE.Vector3().crossVectors(b0, pathTan[0]).normalize());
      pathBi.push(b0);
      for (let i = 1; i < N_PATH; i++) {
        const tan = pathTan[i];
        const n = pathNorm[i-1].clone().addScaledVector(tan, -pathNorm[i-1].dot(tan)).normalize();
        pathNorm.push(n);
        pathBi.push(new THREE.Vector3().crossVectors(tan, n).normalize());
      }
    }

    buildPathFrames(bezPt, bezTan);

    // ── path mode (semantic) ───────────────────────────────────────────────
    let semanticPts: number[][] | null = null;

    function buildSemanticFrames(rawPts: number[][]) {
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
      rawPts.forEach(([x,y,z])=>{ minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z); });
      const range=Math.max(maxX-minX,maxY-minY,maxZ-minZ)||1;
      const cx=(minX+maxX)/2,cy=(minY+maxY)/2,cz=(minZ+maxZ)/2;
      const scale=20.0/range;
      const vecs=rawPts.map(([x,y,z])=>new THREE.Vector3((x-cx)*scale,(y-cy)*scale,(z-cz)*scale));
      const curve=new THREE.CatmullRomCurve3(vecs);
      buildPathFrames(t=>curve.getPointAt(t), t=>curve.getTangentAt(t));
    }

    // ── rng / smooth ───────────────────────────────────────────────────────
    function mkRng(s: number) {
      let seed=s>>>0;
      return ()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/0xffffffff; };
    }
    function smooth(a: Float32Array, w: number) {
      const o = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        let s=0, c=0;
        for (let j=Math.max(0,i-w); j<=Math.min(a.length-1,i+w); j++) { s+=a[j]; c++; }
        o[i]=s/c;
      }
      return o;
    }

    // ── events ─────────────────────────────────────────────────────────────
    const rngE = mkRng(999);
    const events = Array.from({length:8}, (_,i) => ({
      t: 0.05+(i/8)*0.88+(rngE()-0.5)*0.06, strength: 0.5+rngE()*0.5,
    }));
    const GEP = [
      [ 1, 1,-1, 1, 1,-1, 1, 1],
      [-1,-1, 1,-1, 1, 1,-1, 1],
      [-1, 1, 1,-1,-1,-1, 1,-1],
    ];

    function genBase(gi: number, rng: ()=>number) {
      const b = new Float32Array(TOTAL_STEPS+1);
      let v = [0.2,-0.15,0.05][gi]+(rng()-0.5)*0.1; b[0]=v;
      const df=[0.8,1.1,0.6][gi], dp=rng()*Math.PI*2, da=[0.15,0.2,0.12][gi];
      for (let i=1; i<=TOTAL_STEPS; i++) {
        const tl=(i-HISTORY_STEPS)/LIVE_STEPS;
        const drift=Math.sin(tl*Math.PI*2*df+dp)*da;
        let imp=0;
        if (tl>=0) events.forEach((ev,e)=>{ const dt=tl-ev.t; if(dt>-0.01&&dt<0.12){ const sh=dt<0?Math.exp(dt*80):Math.exp(-dt*18); imp+=GEP[gi][e]*ev.strength*sh*0.7; } });
        v+=([0.2,-0.15,0.0][gi]-v)*0.025+(drift-v)*0.008+imp*0.07;
        v=Math.max(-1,Math.min(1,v)); b[i]=v;
      }
      return smooth(b,4);
    }
    function genMember(base: Float32Array, rng: ()=>number, gi: number) {
      const nm=[0.12,0.18,0.25][gi], lm=[8,14,20][gi];
      const pb=(rng()-0.5)*0.18, lag=Math.floor(rng()*lm);
      const o=new Float32Array(TOTAL_STEPS+1);
      let v=base[0]+pb+(rng()-0.5)*0.1; v=Math.max(-1,Math.min(1,v)); o[0]=v;
      for (let i=1; i<=TOTAL_STEPS; i++) {
        v+=(base[Math.max(0,i-lag)]+pb-v)*0.06+(rng()-0.5)*nm*0.35;
        v=Math.max(-1,Math.min(1,v)); o[i]=v;
      }
      return smooth(o,3);
    }

    const baseTraces = [0,1,2].map(gi=>genBase(gi,mkRng(gi*31337+1)));

    const persons: Person[] = [];
    [60,30,10].forEach((sz,gi)=>{
      for (let pi=0; pi<sz; pi++) {
        const rng=mkRng(gi*10000+pi*97+7);
        persons.push({
          gi, vals:genMember(baseTraces[gi],rng,gi),
          isLive: false, liveUserId: null, simSlot: 0,
          angle: 0, dy: 0, dx: 0, ringAngle: 0,
          orbitAngles: new Float32Array(TOTAL_STEPS+1),
          ptsLight: new Float32Array(0),
          colGroup: new Float32Array(0),
          colVal: new Float32Array(0),
        });
      }
    });
    const rngS=mkRng(42);
    for (let i=persons.length-1; i>0; i--) { const j=Math.floor(rngS()*(i+1)); [persons[i],persons[j]]=[persons[j],persons[i]]; }
    persons.forEach((p, i) => { p.simSlot = i; });

    const rngAngle = mkRng(77);
    persons.forEach((p,i)=>{
      p.angle = (i/(TOTAL-1))*Math.PI;
      p.dy = Math.cos(p.angle);
      p.dx = Math.sin(p.angle);
      p.ringAngle = (i/TOTAL)*Math.PI*2;
      p.orbitAngles = new Float32Array(TOTAL_STEPS+1);
      let oa = p.ringAngle + (rngAngle()-0.5)*0.3;
      p.orbitAngles[0] = oa;
      const orbitSpeed = (rngAngle()-0.5)*0.004;
      for (let s=1; s<=TOTAL_STEPS; s++) {
        oa += orbitSpeed + (rngAngle()-0.5)*0.002;
        p.orbitAngles[s] = oa;
      }
    });

    // ── bake DOF-3 "charged" positions ────────────────────────────────────
    const CHARGED_FM = [
      [  0.40, -0.15, -0.90 ],
      [ -0.15,  0.40, -0.90 ],
      [ -0.60, -0.60,  0.50 ],
    ];

    (function bakeCharged() {
      const FRICTION=0.85, R_REPEL=0.028, R_ATTRACT=0.18;
      const REPEL_F=0.0035, ATTRACT_F=0.0018;
      const VALENCE_PULL=0.65, VALENCE_PUSH=0.80;
      const SPRING_K=0.04, WANDER=0.0003;

      function runSim(useForces: boolean) {
        const xKey = useForces ? 'chargedFX' : 'chargedX';
        const yKey = useForces ? 'chargedFY' : 'chargedY';
        const rng = mkRng(useForces ? 77777 : 33333);
        persons.forEach(p => {
          (p as any)[xKey] = new Float32Array(TOTAL_STEPS+1);
          (p as any)[yKey] = new Float32Array(TOTAL_STEPS+1);
          (p as any)[xKey][0] = Math.cos(p.ringAngle) * tubeR;
          (p as any)[yKey][0] = Math.sin(p.ringAngle) * tubeR;
        });
        const vx = new Float32Array(persons.length);
        const vy = new Float32Array(persons.length);
        for (let si=1; si<=TOTAL_STEPS; si++) {
          const fx = new Float32Array(persons.length);
          const fy = new Float32Array(persons.length);
          if (useForces) {
            for (let a=0; a<persons.length; a++) {
              const pa = persons[a];
              const ax=(pa as any)[xKey][si-1], ay=(pa as any)[yKey][si-1];
              for (let b=0; b<persons.length; b++) {
                if (a===b) continue;
                const pb=persons[b];
                const bx=(pb as any)[xKey][si-1], by=(pb as any)[yKey][si-1];
                const dx=bx-ax, dy=by-ay;
                const d=Math.sqrt(dx*dx+dy*dy)||0.0001;
                if (d>=R_ATTRACT) continue;
                const ux=dx/d, uy=dy/d;
                if (d<R_REPEL) {
                  fx[a]-=ux*REPEL_F*(1-d/R_REPEL);
                  fy[a]-=uy*REPEL_F*(1-d/R_REPEL);
                } else {
                  const k=CHARGED_FM[pa.gi][pb.gi]*ATTRACT_F;
                  fx[a]+=ux*k; fy[a]+=uy*k;
                }
              }
            }
          }
          persons.forEach((p, pi) => {
            const cx=(p as any)[xKey][si-1], cy=(p as any)[yKey][si-1];
            const v=p.vals[si];
            const d=Math.sqrt(cx*cx+cy*cy)||0.0001;
            const ux=cx/d, uy=cy/d;
            const targetR=v>=0?tubeR*(1-v*VALENCE_PULL):tubeR*(1+(-v)*VALENCE_PUSH);
            const sf=(targetR-d)*SPRING_K;
            fx[pi]+=ux*sf; fy[pi]+=uy*sf;
            fx[pi]+=-uy*(rng()-0.5)*WANDER;
            fy[pi]+= ux*(rng()-0.5)*WANDER;
            vx[pi]=(vx[pi]+fx[pi])*FRICTION;
            vy[pi]=(vy[pi]+fy[pi])*FRICTION;
            (p as any)[xKey][si]=cx+vx[pi];
            (p as any)[yKey][si]=cy+vy[pi];
          });
        }
      }
      runSim(false);
      runSim(true);
    })();

    // ── world position functions ───────────────────────────────────────────
    function lightWorld(si: number, p: {dx:number,dy:number}, v: number) {
      const pos=pathPos[si], norm=pathNorm[si], bi=pathBi[si];
      return new THREE.Vector3(
        pos.x+(p.dx*norm.x+p.dy*bi.x)*v*MAX_R*radiusScale,
        pos.y+(p.dx*norm.y+p.dy*bi.y)*v*MAX_R*radiusScale,
        pos.z+(p.dx*norm.z+p.dy*bi.z)*v*MAX_R*radiusScale,
      );
    }
    function particleWorldDof1(si: number, p: {ringAngle:number} | {dx:number,dy:number,ringAngle:number}, v: number) {
      const pos=pathPos[si], norm=pathNorm[si], bi=pathBi[si];
      const r=(tubeR-v*TUBE_RANGE)*radiusScale;
      const ca=Math.cos(p.ringAngle), sa=Math.sin(p.ringAngle);
      return new THREE.Vector3(
        pos.x+(ca*norm.x+sa*bi.x)*r,
        pos.y+(ca*norm.y+sa*bi.y)*r,
        pos.z+(ca*norm.z+sa*bi.z)*r,
      );
    }
    function particleWorldDof3(si: number, p: Person) {
      const pos=pathPos[si], norm=pathNorm[si], bi=pathBi[si];
      const cx=(attractedLocal?p.chargedFX![si]:p.chargedX![si])*radiusScale;
      const cy=(attractedLocal?p.chargedFY![si]:p.chargedY![si])*radiusScale;
      return new THREE.Vector3(
        pos.x+cx*norm.x+cy*bi.x,
        pos.y+cx*norm.y+cy*bi.y,
        pos.z+cx*norm.z+cy*bi.z,
      );
    }

    const FORCE_SCALE = 1/TOTAL_STEPS;
    const FORCE_MATRIX = [
      [ 0.8, -0.3, -1.2],
      [-0.3,  0.8, -1.2],
      [-1.2, -1.2,  1.0],
    ];
    function wrapAngle(a: number) {
      while (a> Math.PI) a-=Math.PI*2;
      while (a<-Math.PI) a+=Math.PI*2;
      return a;
    }
    function bakeAttractedAngles() {
      persons.forEach(p => {
        if (!p.orbitAnglesAttracted) p.orbitAnglesAttracted = new Float32Array(TOTAL_STEPS+1);
        p.orbitAnglesAttracted[0] = p.orbitAngles[0];
      });
      for (let si=1; si<=TOTAL_STEPS; si++) {
        const groupMeans=[0,1,2].map(gi=>{
          const gp=persons.filter(p=>p.gi===gi);
          const sx=gp.reduce((s,p)=>s+Math.cos(p.orbitAnglesAttracted![si-1]),0);
          const sy=gp.reduce((s,p)=>s+Math.sin(p.orbitAnglesAttracted![si-1]),0);
          return Math.atan2(sy,sx);
        });
        persons.forEach(p=>{
          const prev=p.orbitAnglesAttracted![si-1];
          const drift=p.orbitAngles[si]-p.orbitAngles[si-1];
          let force=0;
          for (let other=0; other<3; other++) {
            const k=FORCE_MATRIX[p.gi][other];
            if (k===0) continue;
            force+=wrapAngle(groupMeans[other]-prev)*k*FORCE_SCALE;
          }
          p.orbitAnglesAttracted![si]=prev+drift+force;
        });
      }
    }
    bakeAttractedAngles();

    function getOrbitAngle(si: number, p: Person) {
      return attractedLocal?p.orbitAnglesAttracted![si]:p.orbitAngles[si];
    }
    function getWorld(si: number, p: Person, v: number) {
      if (vizModeLocal==='light') return lightWorld(si,p,v);
      if (dofLocal===1) return particleWorldDof1(si,p,v);
      if (dofLocal===3) return particleWorldDof3(si,p);
      const pos=pathPos[si], norm=pathNorm[si], bi=pathBi[si];
      const r=(tubeR-v*TUBE_RANGE)*radiusScale;
      const oa=getOrbitAngle(si,p);
      const ca=Math.cos(oa), sa=Math.sin(oa);
      return new THREE.Vector3(
        pos.x+(ca*norm.x+sa*bi.x)*r,
        pos.y+(ca*norm.y+sa*bi.y)*r,
        pos.z+(ca*norm.z+sa*bi.z)*r,
      );
    }

    // ── bake light-wave positions + colors ─────────────────────────────────
    persons.forEach(p => {
      const N=TOTAL_STEPS+1;
      p.ptsLight=new Float32Array(N*3);
      p.colGroup=new Float32Array(N*3);
      p.colVal=new Float32Array(N*3);
      const gc=GROUP_COLS[p.gi];
      for (let i=0; i<N; i++) {
        const v=p.vals[i], w=lightWorld(i,p,v);
        p.ptsLight[i*3]=w.x; p.ptsLight[i*3+1]=w.y; p.ptsLight[i*3+2]=w.z;
        p.colGroup[i*3]=gc.r; p.colGroup[i*3+1]=gc.g; p.colGroup[i*3+2]=gc.b;
        const vc=valCol(v);
        p.colVal[i*3]=vc.r; p.colVal[i*3+1]=vc.g; p.colVal[i*3+2]=vc.b;
      }
    });

    // ── trail lines ────────────────────────────────────────────────────────
    const trails = persons.map(p => {
      const posBuf=new THREE.BufferAttribute(p.ptsLight.slice(),3);
      posBuf.setUsage(THREE.DynamicDrawUsage);
      const colBuf=new THREE.BufferAttribute(p.colGroup.slice(),3);
      colBuf.setUsage(THREE.DynamicDrawUsage);
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',posBuf); geo.setAttribute('color',colBuf);
      geo.setDrawRange(0,HISTORY_STEPS+1);
      const alpha=p.gi===0?0.22:p.gi===1?0.44:0.88;
      const mat=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:alpha});
      const line=new THREE.Line(geo,mat); line.frustumCulled=false; scene.add(line);
      return {geo,posBuf,colBuf,p};
    });

    // ── fill ribbons ───────────────────────────────────────────────────────
    const fills = persons.map(p => {
      const N=TOTAL_STEPS+1;
      const posBuf=new THREE.BufferAttribute(new Float32Array(N*2*3),3);
      posBuf.setUsage(THREE.DynamicDrawUsage);
      const colGroupF=new Float32Array(N*2*3);
      const colValF=new Float32Array(N*2*3);
      const gc=GROUP_COLS[p.gi];
      for (let i=0; i<N; i++) {
        const v=p.vals[i], w=lightWorld(i,p,v), sp=pathPos[i];
        posBuf.array[i*6+0]=w.x; posBuf.array[i*6+1]=w.y; posBuf.array[i*6+2]=w.z;
        posBuf.array[i*6+3]=sp.x; posBuf.array[i*6+4]=sp.y; posBuf.array[i*6+5]=sp.z;
        colGroupF[i*6]=gc.r; colGroupF[i*6+1]=gc.g; colGroupF[i*6+2]=gc.b;
        colGroupF[i*6+3]=gc.r; colGroupF[i*6+4]=gc.g; colGroupF[i*6+5]=gc.b;
        const vc=valCol(v);
        colValF[i*6]=vc.r; colValF[i*6+1]=vc.g; colValF[i*6+2]=vc.b;
        colValF[i*6+3]=C_NEUTRAL.r; colValF[i*6+4]=C_NEUTRAL.g; colValF[i*6+5]=C_NEUTRAL.b;
      }
      const colBuf=new THREE.BufferAttribute(colGroupF.slice(),3);
      colBuf.setUsage(THREE.DynamicDrawUsage);
      const indices=new Uint32Array((N-1)*6);
      for (let i=0; i<N-1; i++) {
        const a=i*2,b=i*2+1,c=(i+1)*2,d=(i+1)*2+1;
        indices[i*6]=a; indices[i*6+1]=b; indices[i*6+2]=c;
        indices[i*6+3]=b; indices[i*6+4]=d; indices[i*6+5]=c;
      }
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',posBuf); geo.setAttribute('color',colBuf);
      geo.setIndex(new THREE.BufferAttribute(indices,1));
      geo.setDrawRange(0,HISTORY_STEPS*6);
      const mat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:fillAlphaVal,side:THREE.DoubleSide,depthWrite:false});
      const mesh=new THREE.Mesh(geo,mat); mesh.frustumCulled=false; scene.add(mesh);
      return {geo,posBuf,colBuf,mat,colGroupF,colValF,p};
    });

    // ── base spines ────────────────────────────────────────────────────────
    const baseSpines=[0,1,2].map(gi=>{
      const bt=baseTraces[gi], ba=[Math.PI*0.5,Math.PI*0.25,Math.PI*0.75][gi];
      const fp={dx:Math.sin(ba),dy:Math.cos(ba),ringAngle:ba};
      const posBuf=new THREE.BufferAttribute(new Float32Array((TOTAL_STEPS+1)*3),3);
      posBuf.setUsage(THREE.DynamicDrawUsage);
      for (let i=0; i<=TOTAL_STEPS; i++) {
        const w=lightWorld(i,fp,bt[i]);
        posBuf.array[i*3]=w.x; posBuf.array[i*3+1]=w.y; posBuf.array[i*3+2]=w.z;
      }
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',posBuf); geo.setDrawRange(0,HISTORY_STEPS+1);
      const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:GROUP_COLS[gi],transparent:true,opacity:0.9}));
      line.frustumCulled=false; scene.add(line);
      return {line,geo,posBuf,fp,gi};
    });

    // ── narrative spine ────────────────────────────────────────────────────
    const narrativeSpineMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.08});
    const narrativeSpinePosBuf=new THREE.BufferAttribute(new Float32Array((TOTAL_STEPS+1)*3),3);
    narrativeSpinePosBuf.setUsage(THREE.DynamicDrawUsage);
    {
      for (let i=0; i<=TOTAL_STEPS; i++) {
        narrativeSpinePosBuf.array[i*3]=pathPos[i].x;
        narrativeSpinePosBuf.array[i*3+1]=pathPos[i].y;
        narrativeSpinePosBuf.array[i*3+2]=pathPos[i].z;
      }
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',narrativeSpinePosBuf);
      const l=new THREE.Line(geo,narrativeSpineMat); l.frustumCulled=false; scene.add(l);
    }

    // ── baseline tube traces (particle mode) ──────────────────────────────
    const TUBE_N=12;
    let tubeTraces: {
      line: THREE.Line; fillMesh: THREE.Mesh;
      geo: THREE.BufferGeometry; fillGeo: THREE.BufferGeometry;
      lineMat: THREE.LineBasicMaterial; fillMat: THREE.MeshBasicMaterial;
    }[] = [];

    function rebuildTube() {
      tubeTraces.forEach(({line,fillMesh})=>{ scene.remove(line); scene.remove(fillMesh); });
      tubeTraces=[];
      const N=TOTAL_STEPS+1;
      for (let ti=0; ti<TUBE_N; ti++) {
        const ang=(ti/TUBE_N)*Math.PI*2;
        const ca=Math.cos(ang), sa=Math.sin(ang);
        const pts=new Float32Array(N*3);
        for (let i=0; i<N; i++) {
          const pos=pathPos[i], norm=pathNorm[i], bi=pathBi[i];
          pts[i*3]=pos.x+(ca*norm.x+sa*bi.x)*tubeR*radiusScale;
          pts[i*3+1]=pos.y+(ca*norm.y+sa*bi.y)*tubeR*radiusScale;
          pts[i*3+2]=pos.z+(ca*norm.z+sa*bi.z)*tubeR*radiusScale;
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.BufferAttribute(pts,3));
        geo.setDrawRange(0,0);
        const lineMat=new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.35,depthWrite:false});
        const line=new THREE.Line(geo,lineMat); line.visible=false; line.frustumCulled=false; scene.add(line);
        const fpos=new Float32Array(N*2*3);
        for (let i=0; i<N; i++) {
          const pos=pathPos[i], norm=pathNorm[i], bi=pathBi[i], sp=pathPos[i];
          fpos[i*6]=pos.x+(ca*norm.x+sa*bi.x)*tubeR*radiusScale;
          fpos[i*6+1]=pos.y+(ca*norm.y+sa*bi.y)*tubeR*radiusScale;
          fpos[i*6+2]=pos.z+(ca*norm.z+sa*bi.z)*tubeR*radiusScale;
          fpos[i*6+3]=sp.x; fpos[i*6+4]=sp.y; fpos[i*6+5]=sp.z;
        }
        const findices=new Uint32Array((N-1)*6);
        for (let i=0; i<N-1; i++) {
          const a=i*2,b=i*2+1,c=(i+1)*2,d=(i+1)*2+1;
          findices[i*6]=a; findices[i*6+1]=b; findices[i*6+2]=c;
          findices[i*6+3]=b; findices[i*6+4]=d; findices[i*6+5]=c;
        }
        const fillGeo=new THREE.BufferGeometry();
        fillGeo.setAttribute('position',new THREE.BufferAttribute(fpos,3));
        fillGeo.setIndex(new THREE.BufferAttribute(findices,1));
        fillGeo.setDrawRange(0,0);
        const fillMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:fillAlphaVal*0.6,side:THREE.DoubleSide,depthWrite:false});
        const fillMesh=new THREE.Mesh(fillGeo,fillMat); fillMesh.visible=false; fillMesh.frustumCulled=false; scene.add(fillMesh);
        tubeTraces.push({line,fillMesh,geo,fillGeo,lineMat,fillMat});
      }
    }
    function setTubeVisible(v: boolean) { tubeTraces.forEach(({line,fillMesh})=>{ line.visible=v; fillMesh.visible=v; }); }
    function setTubeOpacity(alpha: number) { tubeTraces.forEach(({lineMat,fillMat})=>{ lineMat.opacity=0.35; fillMat.opacity=alpha*0.6; }); }
    function setTubeDrawRange(si: number) { tubeTraces.forEach(({geo,fillGeo})=>{ geo.setDrawRange(0,si+1); fillGeo.setDrawRange(0,Math.max(0,si-1)*6); }); }
    rebuildTube();

    // ── ring ───────────────────────────────────────────────────────────────
    const RING_SEGS=96;
    const ringPosBuf=new THREE.BufferAttribute(new Float32Array((RING_SEGS+1)*3),3);
    ringPosBuf.setUsage(THREE.DynamicDrawUsage);
    const ringGeo=new THREE.BufferGeometry(); ringGeo.setAttribute('position',ringPosBuf);
    const ring=new THREE.Line(ringGeo,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:0.12}));
    scene.add(ring);
    function updateRing(si: number) {
      const norm=pathNorm[si],bi=pathBi[si],pos=pathPos[si];
      const r=(vizModeLocal==='light'?MAX_R*1.1:tubeR)*radiusScale;
      for (let i=0; i<=RING_SEGS; i++) {
        const a=(i/RING_SEGS)*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
        ringPosBuf.array[i*3]=pos.x+(norm.x*ca+bi.x*sa)*r;
        ringPosBuf.array[i*3+1]=pos.y+(norm.y*ca+bi.y*sa)*r;
        ringPosBuf.array[i*3+2]=pos.z+(norm.z*ca+bi.z*sa)*r;
      }
      ringPosBuf.needsUpdate=true;
    }
    updateRing(HISTORY_STEPS);

    // ── cursor dots ────────────────────────────────────────────────────────
    const dots=persons.map(p=>{
      const geo=new THREE.SphereGeometry(0.009,7,7);
      const mat=new THREE.MeshBasicMaterial({color:GROUP_COLS[p.gi].clone(),transparent:true,opacity:0.97});
      const mesh=new THREE.Mesh(geo,mat); scene.add(mesh);
      return {mesh,mat,p};
    });

    // ── position rebuild ───────────────────────────────────────────────────
    let particleWrittenTo=-1;
    let tNorm=0;

    function writeParticleRange(from: number, to: number) {
      trails.forEach(({posBuf,p})=>{
        for (let i=from; i<=to; i++) {
          const v=p.vals[i], w=getWorld(i,p,v);
          posBuf.array[i*3]=w.x; posBuf.array[i*3+1]=w.y; posBuf.array[i*3+2]=w.z;
        }
        posBuf.needsUpdate=true;
      });
      fills.forEach(({posBuf,p})=>{
        for (let i=from; i<=to; i++) {
          const v=p.vals[i], w=getWorld(i,p,v), sp=pathPos[i];
          posBuf.array[i*6+0]=w.x; posBuf.array[i*6+1]=w.y; posBuf.array[i*6+2]=w.z;
          posBuf.array[i*6+3]=sp.x; posBuf.array[i*6+4]=sp.y; posBuf.array[i*6+5]=sp.z;
        }
        posBuf.needsUpdate=true;
      });
    }
    function rebuildAllPositions() {
      if (vizModeLocal==='light') {
        trails.forEach(({posBuf,p})=>{ posBuf.array.set(p.ptsLight); posBuf.needsUpdate=true; });
        fills.forEach(({posBuf,p})=>{
          const N=TOTAL_STEPS+1;
          for (let i=0;i<N;i++){
            const v=p.vals[i],w=lightWorld(i,p,v),sp=pathPos[i];
            posBuf.array[i*6+0]=w.x;posBuf.array[i*6+1]=w.y;posBuf.array[i*6+2]=w.z;
            posBuf.array[i*6+3]=sp.x;posBuf.array[i*6+4]=sp.y;posBuf.array[i*6+5]=sp.z;
          }
          posBuf.needsUpdate=true;
        });
        particleWrittenTo=TOTAL_STEPS;
      } else {
        const curSi=HISTORY_STEPS+Math.min(Math.round(tNorm*LIVE_STEPS),LIVE_STEPS);
        writeParticleRange(0,curSi);
        particleWrittenTo=curSi;
      }
      baseSpines.forEach(({posBuf,fp,gi})=>{
        const bt=baseTraces[gi];
        for (let i=0;i<=TOTAL_STEPS;i++) {
          const w=vizModeLocal==='light'?lightWorld(i,fp,bt[i]):particleWorldDof1(i,fp,bt[i]);
          posBuf.array[i*3]=w.x; posBuf.array[i*3+1]=w.y; posBuf.array[i*3+2]=w.z;
        }
        posBuf.needsUpdate=true;
      });
    }
    function updateParticlePositions(si: number) {
      if (vizModeLocal==='light') return;
      if (si<particleWrittenTo-5) { writeParticleRange(0,si); particleWrittenTo=si; }
      else if (si>particleWrittenTo) { writeParticleRange(particleWrittenTo+1,si); particleWrittenTo=si; }
    }
    function rebuildPathDependentData() {
      persons.forEach(p=>{
        const N=TOTAL_STEPS+1;
        for (let i=0;i<N;i++) { const w=lightWorld(i,p,p.vals[i]); p.ptsLight[i*3]=w.x; p.ptsLight[i*3+1]=w.y; p.ptsLight[i*3+2]=w.z; }
      });
      for (let i=0;i<=TOTAL_STEPS;i++) {
        narrativeSpinePosBuf.array[i*3]=pathPos[i].x;
        narrativeSpinePosBuf.array[i*3+1]=pathPos[i].y;
        narrativeSpinePosBuf.array[i*3+2]=pathPos[i].z;
      }
      narrativeSpinePosBuf.needsUpdate=true;
      rebuildTube();
      rebuildAllPositions();
      updateRing(HISTORY_STEPS);
    }
    function applyFillColors() {
      fills.forEach(({colBuf,colGroupF,colValF})=>{
        colBuf.array.set(fillModeLocal==='group'?colGroupF:colValF); colBuf.needsUpdate=true;
      });
    }
    function updateLegend() {
      const sg=dotModeLocal==='group'||trailModeLocal==='group'||fillModeLocal==='group';
      const sv=dotModeLocal==='valence'||trailModeLocal==='valence'||fillModeLocal==='valence';
      setLegGroup(sg); setLegVal(sv);
    }

    // ── orbit / camera ─────────────────────────────────────────────────────
    let orbitTheta=0, orbitPhi=0.18, dragActive=false, lastX=0, lastY=0;
    let camDist=0.9;
    let camModeLocal='static';
    let camTargetModeLocal: 'head'|'trail'='head';
    const CAM_LOOKBACK=80;
    let pinchDist0: number|null=null;
    let smoothCamPos: THREE.Vector3|null=null;
    let smoothTarget: THREE.Vector3|null=null;
    let smoothCamVel: THREE.Vector3|null=null;
    let smoothTargetVel: THREE.Vector3|null=null;
    let camPrevTs: number|null=null;

    function onPointerDown(x: number, y: number) { dragActive=true; lastX=x; lastY=y; }
    function onPointerMove(x: number, y: number) {
      if(!dragActive) return;
      orbitTheta-=(x-lastX)*0.008; orbitPhi-=(y-lastY)*0.006;
      orbitPhi=Math.max(-Math.PI/2+0.05,Math.min(Math.PI/2-0.05,orbitPhi));
      lastX=x; lastY=y;
    }
    function onPointerUp() { dragActive=false; }

    canvas.addEventListener('mousedown', e=>onPointerDown(e.clientX,e.clientY));
    canvas.addEventListener('mousemove', e=>onPointerMove(e.clientX,e.clientY));
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', e=>{ e.preventDefault(); onPointerDown(e.touches[0].clientX,e.touches[0].clientY); },{passive:false});
    canvas.addEventListener('touchmove', e=>{ e.preventDefault(); onPointerMove(e.touches[0].clientX,e.touches[0].clientY); },{passive:false});
    canvas.addEventListener('touchend', onPointerUp);
    canvas.addEventListener('wheel', e=>{ e.preventDefault(); camDist=Math.max(0.15,Math.min(15.0,camDist*(1+e.deltaY*0.001))); },{passive:false});
    canvas.addEventListener('touchstart', e=>{ if(e.touches.length===2) pinchDist0=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); },{passive:true});
    canvas.addEventListener('touchmove', e=>{ if(e.touches.length===2&&pinchDist0!==null){ const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY); camDist=Math.max(0.15,Math.min(15.0,camDist*(pinchDist0/d))); pinchDist0=d; } },{passive:true});
    canvas.addEventListener('touchend', e=>{ if(e.touches.length<2) pinchDist0=null; },{passive:true});

    // ── playback ───────────────────────────────────────────────────────────
    let playingLocal=true;
    let lastTs: number|null=null;
    let isScrubbing=false;
    const SPEED=1/70;

    // ── live state ─────────────────────────────────────────────────────────
    const cursors=new Map<string,{x:number,y:number}>();
    const liveUsers=new Map<string,number>();

    function clamp(v: number, lo: number, hi: number) { return Math.max(lo,Math.min(hi,v)); }
    const ANCHORS={positive:{x:95,y:5},negative:{x:5,y:95},neutral:{x:95,y:95}};
    function cursorMoodValue(nx: number, ny: number) {
      const x=nx/100, y=ny/100;
      const pos={x:ANCHORS.positive.x/100,y:ANCHORS.positive.y/100};
      const neg={x:ANCHORS.negative.x/100,y:ANCHORS.negative.y/100};
      const neu={x:ANCHORS.neutral.x/100,y:ANCHORS.neutral.y/100};
      const denom=(neg.y-neu.y)*(pos.x-neu.x)+(neu.x-neg.x)*(pos.y-neu.y);
      if (Math.abs(denom)<1e-10) {
        const dp=Math.hypot(x-pos.x,y-pos.y);
        const dn=Math.hypot(x-neg.x,y-neg.y);
        const dz=Math.hypot(x-neu.x,y-neu.y);
        const wPos=(1/(dp||1e-9))/((1/(dp||1e-9))+(1/(dn||1e-9))+(1/(dz||1e-9)));
        const wNeg=(1/(dn||1e-9))/((1/(dp||1e-9))+(1/(dn||1e-9))+(1/(dz||1e-9)));
        return clamp(wPos*100+wNeg*0+(1-wPos-wNeg)*50,0,100);
      }
      const wPos=((neg.y-neu.y)*(x-neu.x)+(neu.x-neg.x)*(y-neu.y))/denom;
      const wNeg=((neu.y-pos.y)*(x-neu.x)+(pos.x-neu.x)*(y-neu.y))/denom;
      return clamp(wPos*100+wNeg*0+(1-wPos-wNeg)*50,0,100);
    }
    function cursorValence(nx: number, ny: number) { return (cursorMoodValue(nx,ny)-50)/50; }
    function assignLiveSlot(userId: string) {
      if (liveUsers.has(userId)) return;
      const free=persons.map((p,i)=>(!p.isLive?i:-1)).filter(i=>i>=0);
      if (free.length===0) return;
      const slot=free[Math.floor(Math.random()*free.length)];
      persons[slot].isLive=true; persons[slot].liveUserId=userId;
      liveUsers.set(userId,slot);
      if (liveUsers.size>0) setLiveBadge(true);
    }
    function freeLiveSlot(userId: string) {
      const slot=liveUsers.get(userId); if (slot===undefined) return;
      persons[slot].isLive=false; persons[slot].liveUserId=null;
      liveUsers.delete(userId);
      if (liveUsers.size===0) setLiveBadge(false);
    }
    function freeAllLiveSlots() { for (const u of [...liveUsers.keys()]) freeLiveSlot(u); cursors.clear(); }

    // ── WebSocket ──────────────────────────────────────────────────────────
    let ws: WebSocket|null=null;
    let wsConnectedLocal=false;
    let wsReconnectTimer: ReturnType<typeof setTimeout>|null=null;

    function connectWs(room: string) {
      if (ws) { ws.onclose=null; ws.close(); ws=null; }
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      setWsStatusText('connecting…'); setWsStatusCls('connecting');
      setWsConnected(false);
      const host=window.location.port==='1999'?`${window.location.hostname}:1999`:window.location.hostname;
      const proto=window.location.port==='1999'?'ws':'wss';
      const userId=generateUUID();
      ws=new WebSocket(`${proto}://${host}/parties/main/${encodeURIComponent(room)}?isAdmin=true&userId=${userId}`);
      ws.onopen=()=>{
        wsConnectedLocal=true;
        setWsStatusText(`connected · room: ${room}`); setWsStatusCls('ok');
        setWsConnected(true); setAudienceVisible(true);
      };
      ws.onmessage=(evt)=>{
        let data: any;
        try { data=JSON.parse(evt.data); } catch { return; }
        if (data.type==='presenceCount') {
          const n=data.count??0; setAudienceN(n);
          setWsStatusText(`connected · room: ${room} · ${n} participant${n!==1?'s':''}`);
        } else if (data.type==='userJoined') {
          assignLiveSlot(data.userId);
        } else if (data.type==='userLeft') {
          cursors.delete(data.userId); freeLiveSlot(data.userId);
        } else if (data.type==='move'||data.type==='touch') {
          const {userId,x,y}=data.position;
          cursors.set(userId,{x,y}); assignLiveSlot(userId); setAudienceN(cursors.size);
        } else if (data.type==='remove') {
          const {userId}=data.position; cursors.delete(userId);
          if (userId.startsWith('replay_')) freeLiveSlot(userId);
          setAudienceN(cursors.size);
        }
      };
      ws.onerror=()=>{ setWsStatusText('connection error'); setWsStatusCls('warn'); };
      ws.onclose=()=>{
        wsConnectedLocal=false; freeAllLiveSlots();
        setWsConnected(false); setAudienceVisible(false);
        setWsStatusText('reconnecting…'); setWsStatusCls('warn');
        wsReconnectTimer=setTimeout(()=>connectWs(room),3000);
      };
    }
    function disconnectWs() {
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      if (ws) { ws.onclose=null; ws.close(); ws=null; }
      wsConnectedLocal=false; freeAllLiveSlots();
      setWsConnected(false); setAudienceVisible(false);
      setWsStatusText('disconnected'); setWsStatusCls('');
    }

    // ── render loop ────────────────────────────────────────────────────────
    let animFrameId: number;
    function animate(ts: number) {
      animFrameId=requestAnimationFrame(animate);
      const dt=camPrevTs===null?0:Math.min((ts-camPrevTs)/1000,0.1);
      camPrevTs=ts;

      if (playingLocal && !isScrubbing) {
        if(lastTs==null) lastTs=ts;
        tNorm=Math.min(1,tNorm+(ts-lastTs)/1000*SPEED);
        if(tNorm>=1) tNorm=0;
        lastTs=ts;
        if (scrubRef.current) scrubRef.current.value=String(Math.round(tNorm*1000));
      } else {
        if (scrubRef.current) tNorm=parseInt(scrubRef.current.value)/1000;
        if (!isScrubbing) lastTs=null;
      }
      const si=HISTORY_STEPS+Math.min(Math.round(tNorm*LIVE_STEPS),LIVE_STEPS);
      const sec=Math.round(tNorm*DURATION);
      if (tdispRef.current) tdispRef.current.textContent='t='+(Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'));

      persons.forEach((p,pi)=>{
        if (!p.isLive) return;
        const cursor=cursors.get(p.liveUserId!);
        const v=cursor?cursorValence(cursor.x,cursor.y):0;
        p.vals[si]=v;
        const gc=GROUP_COLS[p.gi], vc=valCol(v);
        const col=trailModeLocal==='group'?gc:vc;
        const fc=fillModeLocal==='group'?gc:vc;
        const fcs=fillModeLocal==='group'?gc:C_NEUTRAL;
        const t=trails[pi];
        t.colBuf.array[si*3]=col.r; t.colBuf.array[si*3+1]=col.g; t.colBuf.array[si*3+2]=col.b;
        t.colBuf.needsUpdate=true;
        const f=fills[pi];
        f.colBuf.array[si*6]=fc.r; f.colBuf.array[si*6+1]=fc.g; f.colBuf.array[si*6+2]=fc.b;
        f.colBuf.array[si*6+3]=fcs.r; f.colBuf.array[si*6+4]=fcs.g; f.colBuf.array[si*6+5]=fcs.b;
        f.colBuf.needsUpdate=true;
        if (vizModeLocal==='light') {
          const w=lightWorld(si,p,v), sp=pathPos[si];
          t.posBuf.array[si*3]=w.x; t.posBuf.array[si*3+1]=w.y; t.posBuf.array[si*3+2]=w.z;
          t.posBuf.needsUpdate=true;
          f.posBuf.array[si*6]=w.x; f.posBuf.array[si*6+1]=w.y; f.posBuf.array[si*6+2]=w.z;
          f.posBuf.array[si*6+3]=sp.x; f.posBuf.array[si*6+4]=sp.y; f.posBuf.array[si*6+5]=sp.z;
          f.posBuf.needsUpdate=true;
        }
      });

      updateParticlePositions(si);
      trails.forEach(({geo,p})=>geo.setDrawRange(0,(p.isLive||p.simSlot<simCountLocal)?si+1:0));
      if(vizModeLocal==='particle') setTubeDrawRange(simCountLocal>0?si:0);
      baseSpines.forEach(({geo})=>geo.setDrawRange(0,simCountLocal>0?si+1:0));
      fills.forEach(({geo,p})=>geo.setDrawRange(0,(p.isLive||p.simSlot<simCountLocal)?Math.max(0,si-1)*6:0));
      updateRing(si);

      dots.forEach(({mesh,mat,p})=>{
        if (!p.isLive&&p.simSlot>=simCountLocal) { mesh.visible=false; return; }
        mesh.visible=true;
        const v=p.vals[si], w=getWorld(si,p,v);
        mesh.position.copy(w);
        mat.color.copy(dotModeLocal==='group'?GROUP_COLS[p.gi]:valCol(v));
      });

      const lt=pathPos[si].clone();
      const vi=camTargetModeLocal==='trail'?Math.max(0,si-CAM_LOOKBACK):si;
      const tan=pathTan[vi], norm=pathNorm[vi], bi=pathBi[vi];
      const fwd=tan.clone().negate();
      const desiredPos=pathPos[vi].clone().add(
        new THREE.Vector3()
          .addScaledVector(fwd,  Math.cos(orbitPhi)*Math.cos(orbitTheta))
          .addScaledVector(norm, Math.sin(orbitPhi))
          .addScaledVector(bi,   Math.cos(orbitPhi)*Math.sin(orbitTheta))
          .normalize().multiplyScalar(camDist)
      );

      if (camModeLocal==='static') {
        camera.position.copy(desiredPos); camera.lookAt(lt); camera.up.copy(norm);
      } else if (camModeLocal==='lerp') {
        if (!smoothCamPos) { smoothCamPos=desiredPos.clone(); smoothTarget=lt.clone(); }
        smoothCamPos.lerp(desiredPos,0.08); smoothTarget!.lerp(lt,0.08);
        camera.position.copy(smoothCamPos); camera.lookAt(smoothTarget!); camera.up.copy(norm);
      } else if (camModeLocal==='exp') {
        if (!smoothCamPos) { smoothCamPos=desiredPos.clone(); smoothTarget=lt.clone(); }
        const alpha=1-Math.exp(-8.0*dt);
        smoothCamPos.lerp(desiredPos,alpha); smoothTarget!.lerp(lt,alpha);
        camera.position.copy(smoothCamPos); camera.lookAt(smoothTarget!); camera.up.copy(norm);
      } else if (camModeLocal==='spring') {
        if (!smoothCamPos) { smoothCamPos=desiredPos.clone(); smoothTarget=lt.clone(); smoothCamVel=new THREE.Vector3(); smoothTargetVel=new THREE.Vector3(); }
        const SPRING=120, DAMP=20;
        smoothCamVel!.addScaledVector(desiredPos.clone().sub(smoothCamPos),SPRING*dt);
        smoothCamVel!.multiplyScalar(Math.max(0,1-DAMP*dt));
        smoothCamPos.addScaledVector(smoothCamVel!,dt);
        smoothTargetVel!.addScaledVector(lt.clone().sub(smoothTarget!),SPRING*dt);
        smoothTargetVel!.multiplyScalar(Math.max(0,1-DAMP*dt));
        smoothTarget!.addScaledVector(smoothTargetVel!,dt);
        camera.position.copy(smoothCamPos); camera.lookAt(smoothTarget!); camera.up.copy(norm);
      } else if (camModeLocal==='quat') {
        if (!smoothCamPos) { smoothCamPos=desiredPos.clone(); smoothTarget=lt.clone(); }
        const alpha=1-Math.exp(-8.0*dt);
        smoothCamPos.lerp(desiredPos,alpha); smoothTarget!.lerp(lt,alpha);
        const m=new THREE.Matrix4().lookAt(desiredPos,lt,norm);
        camera.position.copy(smoothCamPos);
        camera.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m),alpha);
      }

      renderer.render(scene,camera);
    }
    animFrameId=requestAnimationFrame(animate);

    // ── resize ─────────────────────────────────────────────────────────────
    function handleResize() {
      const W=wrap.clientWidth, H=wrap.clientHeight;
      renderer.setSize(W,H); camera.aspect=W/H; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize',handleResize);

    // ── keyboard ───────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code==='Space'&&e.target instanceof Element&&e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA') {
        e.preventDefault();
        playingLocal=!playingLocal;
        setPlaying(playingLocal);
        if (playingLocal) lastTs=null;
      }
    }
    document.addEventListener('keydown',handleKeyDown);

    // ── expose actions ─────────────────────────────────────────────────────
    actionsRef.current = {
      togglePlay: () => {
        playingLocal=!playingLocal;
        setPlaying(playingLocal);
        if (playingLocal) lastTs=null;
      },
      setScrubbing: (scrubbing: boolean) => {
        isScrubbing=scrubbing;
        if (!scrubbing) lastTs=null;
      },
      onVizModeChange: (mode) => {
        vizModeLocal=mode;
        if (mode==='light') {
          setTubeVisible(false);
          baseSpines.forEach(({line})=>{ if(trailModeLocal==='group') line.visible=true; });
          narrativeSpineMat.opacity=0.08;
        } else {
          setTubeVisible(true);
          baseSpines.forEach(({line})=>{ line.visible=false; });
          narrativeSpineMat.opacity=0.7;
        }
        rebuildAllPositions();
        setShowDof(mode==='particle');
        setShowAttract(mode==='particle'&&(dofLocal===2||dofLocal===3));
        setShowRowParticle(mode==='particle');
      },
      onDofChange: (d) => {
        dofLocal=d;
        setShowAttract(d===2||d===3);
        if (vizModeLocal==='particle') rebuildAllPositions();
      },
      onAttractedChange: (a) => {
        attractedLocal=a;
        if (vizModeLocal==='particle'&&dofLocal===2) rebuildAllPositions();
      },
      onPathModeChange: (mode) => {
        if (mode==='semantic'&&!semanticPts) {
          fetch('sample-embeddings-3d.json').then(r=>r.json()).then((pts: number[][])=>{
            semanticPts=pts;
            setPathMode('semantic');
            doSwitchPath('semantic');
          });
        } else {
          setPathMode(mode);
          doSwitchPath(mode);
        }
      },
      onDotModeChange: (m) => { dotModeLocal=m; updateLegend(); },
      onTrailModeChange: (m) => {
        trailModeLocal=m;
        trails.forEach(({colBuf,p})=>{ colBuf.array.set(m==='group'?p.colGroup:p.colVal); colBuf.needsUpdate=true; });
        if(vizModeLocal==='light') baseSpines.forEach(({line})=>{ line.visible=m==='group'; });
        updateLegend();
      },
      onFillModeChange: (m) => { fillModeLocal=m; applyFillColors(); updateLegend(); },
      onFillAlphaChange: (v) => {
        fillAlphaVal=v;
        fills.forEach(({mat})=>{ mat.opacity=fillAlphaVal; });
        setTubeOpacity(fillAlphaVal);
      },
      onRadiusChange: (v) => {
        if (vizModeLocal==='light') {
          MAX_R=v;
          persons.forEach(p=>{ const N=TOTAL_STEPS+1; for (let i=0;i<N;i++) { const w=lightWorld(i,p,p.vals[i]); p.ptsLight[i*3]=w.x; p.ptsLight[i*3+1]=w.y; p.ptsLight[i*3+2]=w.z; } });
          rebuildAllPositions();
        } else { tubeR=v; rebuildTube(); rebuildAllPositions(); }
      },
      onSimCountChange: (n) => { simCountLocal=n; },
      onCamModeChange: (mode) => {
        camModeLocal=mode;
        smoothCamPos=null; smoothTarget=null; smoothCamVel=null; smoothTargetVel=null;
      },
      onCamTargetChange: (mode) => {
        camTargetModeLocal=mode;
        smoothCamPos=null; smoothTarget=null; smoothCamVel=null; smoothTargetVel=null;
      },
      connectWs,
      disconnectWs,
      isWsConnected: () => wsConnectedLocal,
      isWsConnecting: () => !wsConnectedLocal&&ws!==null,
    };

    function doSwitchPath(mode: 'simple'|'semantic') {
      if (mode==='simple') { buildPathFrames(bezPt,bezTan); DURATION=300; radiusScale=1.0; }
      else { buildSemanticFrames(semanticPts!); DURATION=471; radiusScale=1.0; }
      tNorm=0; lastTs=null;
      smoothCamPos=null; smoothTarget=null; smoothCamVel=null; smoothTargetVel=null;
      if (scrubRef.current) scrubRef.current.value='0';
      rebuildPathDependentData();
      dots.forEach(({mesh})=>mesh.scale.setScalar(radiusScale));
    }

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize',handleResize);
      document.removeEventListener('keydown',handleKeyDown);
      disconnectWs();
      renderer.dispose();
      actionsRef.current=null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── JSX event handlers ─────────────────────────────────────────────────────
  function handleRoomInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setRoomInputVal(val);
    const params = new URLSearchParams(window.location.search);
    if (val && val !== 'default') params.set('room', val);
    else params.delete('room');
    const qs = params.toString();
    history.replaceState(null, '', (qs ? '?' + qs : '') + window.location.hash);
  }

  function handleConnectClick() {
    if (!actionsRef.current) return;
    if (actionsRef.current.isWsConnected() || actionsRef.current.isWsConnecting()) {
      actionsRef.current.disconnectWs();
    } else {
      actionsRef.current.connectWs(roomInputVal || 'default');
    }
  }

  function handleVizMode(mode: 'light' | 'particle') {
    setVizMode(mode);
    actionsRef.current?.onVizModeChange(mode);
  }
  function handleDof(d: 1 | 2 | 3) {
    setDof(d);
    actionsRef.current?.onDofChange(d);
  }
  function handleAttracted(a: boolean) {
    setAttracted(a);
    actionsRef.current?.onAttractedChange(a);
  }
  function handlePathMode(mode: 'simple' | 'semantic') {
    actionsRef.current?.onPathModeChange(mode);
  }
  function handleDotMode(m: 'group' | 'valence') {
    setDotMode(m);
    actionsRef.current?.onDotModeChange(m);
  }
  function handleTrailMode(m: 'group' | 'valence') {
    setTrailMode(m);
    actionsRef.current?.onTrailModeChange(m);
  }
  function handleFillMode(m: 'group' | 'valence') {
    setFillMode(m);
    actionsRef.current?.onFillModeChange(m);
  }
  function handleSimCount(n: number) {
    setSimCount(n);
    actionsRef.current?.onSimCountChange(n);
  }
  function handleCamMode() {
    const next = CAM_MODES[(CAM_MODES.indexOf(camMode) + 1) % CAM_MODES.length];
    setCamMode(next);
    actionsRef.current?.onCamModeChange(next);
  }
  function handleCamTarget() {
    const next = camTargetMode === 'head' ? 'trail' : 'head';
    setCamTargetMode(next);
    actionsRef.current?.onCamTargetChange(next);
  }
  function handlePlay() {
    actionsRef.current?.togglePlay();
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="vviz-root">
      <div className="vviz-top-strip">
        <div className="vviz-strip-title">valence viz · facilitator</div>
        <div className="vviz-strip-conn">
          <label htmlFor="vviz-room-input">room</label>
          <input
            id="vviz-room-input"
            type="text"
            className="vviz-room-input"
            placeholder="default"
            autoComplete="off"
            spellCheck={false}
            value={roomInputVal}
            onChange={handleRoomInput}
          />
          <button
            className={`vviz-btn-connect${wsConnected ? ' disconnecting' : ''}`}
            onClick={handleConnectClick}
          >
            {wsConnected ? 'disconnect' : 'connect'}
          </button>
        </div>
        <div className={`vviz-conn-status${wsStatusCls ? ' ' + wsStatusCls : ''}`}>{wsStatusText}</div>

        <div className="vviz-strip-sim">
          <span className="vviz-strip-sync-label">simulated users</span>
          <div className="vviz-pill-toggle">
            {[100, 50, 25, 0].map(n => (
              <button
                key={n}
                className={simCount === n ? 'active' : ''}
                onClick={() => handleSimCount(n)}
              >{n}</button>
            ))}
          </div>
        </div>

        {audienceVisible && (
          <div className="vviz-audience-count">
            audience: <span>{audienceN}</span>
          </div>
        )}
      </div>

      <div className="vviz-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="vviz-canvas" />

        <div className="vviz-hud">
          <div ref={tdispRef}>t = 0:00</div>
          {liveBadge && <div className="vviz-live-badge">● live</div>}
          {legGroup && (
            <div style={{marginTop:'3px'}}>
              <span style={{color:'#38bdf8'}}>■</span> A (60)&nbsp;
              <span style={{color:'#fbbf24'}}>■</span> B (30)&nbsp;
              <span style={{color:'#a78bfa'}}>■</span> C (10)
            </div>
          )}
          {legVal && (
            <div style={{marginTop:'3px'}}>
              <span style={{color:'#ff2222'}}>■</span> disagree&nbsp;
              <span style={{color:'#1e293b'}}>■</span> neutral&nbsp;
              <span style={{color:'#00ff7f'}}>■</span> agree
            </div>
          )}
          <div className="vviz-hud-hint">drag to orbit</div>
        </div>

        <div className="vviz-modebar">
          <div className="vviz-modebar-row">
            <button className={pathMode === 'simple' ? 'active' : ''} onClick={() => handlePathMode('simple')}>simple curves</button>
            <button className={pathMode === 'semantic' ? 'active' : ''} onClick={() => handlePathMode('semantic')}>demo semantic</button>
          </div>
          <div className="vviz-modebar-row">
            <button className={vizMode === 'light' ? 'active' : ''} onClick={() => handleVizMode('light')}>light waves</button>
            <button className={vizMode === 'particle' ? 'active' : ''} onClick={() => handleVizMode('particle')}>charged particles</button>
          </div>
          {showDof && (
            <div className="vviz-modebar-row">
              <button className={dof === 1 ? 'active' : ''} onClick={() => handleDof(1)}>pinned</button>
              <button className={dof === 2 ? 'active' : ''} onClick={() => handleDof(2)}>orbital</button>
              <button className={dof === 3 ? 'active' : ''} onClick={() => handleDof(3)}>charged</button>
            </div>
          )}
          {showAttract && (
            <div className="vviz-modebar-row">
              <button className={!attracted ? 'active' : ''} onClick={() => handleAttracted(false)}>forces off</button>
              <button className={attracted ? 'active' : ''} onClick={() => handleAttracted(true)}>forces between groups</button>
            </div>
          )}
        </div>

        <div className="vviz-controls">
          <div className="vviz-row-scrub">
            <button className="vviz-btn" style={{width:'6em',textAlign:'center',whiteSpace:'nowrap'}} onClick={handlePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <input
              ref={scrubRef}
              type="range"
              className="vviz-scrub"
              min={0}
              max={1000}
              defaultValue={0}
              onPointerDown={() => { actionsRef.current?.setScrubbing(true); }}
              onPointerUp={() => { actionsRef.current?.setScrubbing(false); }}
            />
            <button
              className="vviz-btn"
              style={{width:'9em',textAlign:'center',whiteSpace:'nowrap'}}
              onClick={handleCamMode}
            >cam: {camMode}</button>
            <button
              className="vviz-btn"
              style={{width:'5em',textAlign:'center',whiteSpace:'nowrap'}}
              onClick={handleCamTarget}
            >{camTargetMode}</button>
          </div>

          <div className="vviz-row-toggles">
            <div className="vviz-tcol">
              <div className="vviz-tcol-lbl">cursor</div>
              <button className={dotMode === 'group' ? 'active' : ''} onClick={() => handleDotMode('group')}>group</button>
              <button className={dotMode === 'valence' ? 'active' : ''} onClick={() => handleDotMode('valence')}>valence</button>
            </div>
            <div className="vviz-tcol">
              <div className="vviz-tcol-lbl">trail</div>
              <button className={trailMode === 'group' ? 'active' : ''} onClick={() => handleTrailMode('group')}>group</button>
              <button className={trailMode === 'valence' ? 'active' : ''} onClick={() => handleTrailMode('valence')}>valence</button>
            </div>
            <div className="vviz-tcol">
              <div className="vviz-tcol-lbl">fill</div>
              <button className={fillMode === 'group' ? 'active' : ''} onClick={() => handleFillMode('group')}>group</button>
              <button className={fillMode === 'valence' ? 'active' : ''} onClick={() => handleFillMode('valence')}>valence</button>
            </div>
            <div className="vviz-tcol vviz-tcol-flex">
              <div className="vviz-tcol-lbl">fill opacity</div>
              <input
                type="range"
                min={0}
                max={100}
                defaultValue={12}
                onChange={e => actionsRef.current?.onFillAlphaChange(parseInt(e.target.value) / 100)}
              />
            </div>
            <div className="vviz-tcol vviz-tcol-flex">
              <div className="vviz-tcol-lbl">radius</div>
              <input
                type="range"
                min={5}
                max={60}
                defaultValue={22}
                onChange={e => actionsRef.current?.onRadiusChange(parseInt(e.target.value) / 100)}
              />
            </div>
          </div>

          {showRowParticle && <div className="vviz-row-particle" />}
        </div>
      </div>
    </div>
  );
}
