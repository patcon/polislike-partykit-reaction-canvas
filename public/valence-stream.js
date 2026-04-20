/**
 * valence-stream.js
 *
 * Generates a continuous stream of simulated participant valence values
 * based on the group-correlated trace model from valence-onboarding-v2.
 *
 * Participants are assigned to groups using Fibonacci-proportional weights
 * (matching onboarding-v2). Each group has a shared target value that
 * randomizes on "valence shift" events. Participants drift toward their
 * group target plus per-participant noise.
 *
 * Usage (browser or Node):
 *
 *   const stream = new ValenceStream({
 *     numGroups: 3,
 *     numParticipants: 50,
 *     eventIntervalSeconds: 8,   // how often a valence shift fires
 *     noiseAmount: 0.12,         // per-participant ± noise on group target
 *     driftSpeed: 0.02,          // lerp factor per tick toward target
 *     windowMinutes: 5,          // sliding window history length
 *     tickRateHz: 10,            // ticks per second
 *   });
 *
 *   stream.addEventListener('frame', e => {
 *     // e.detail: { timestamp, participants: [{id, group, value}], eventFired }
 *     console.log(e.detail);
 *   });
 *
 *   stream.addEventListener('event', e => {
 *     // e.detail: { timestamp, groupTargets: [...] }
 *     console.log('valence shift!', e.detail);
 *   });
 *
 *   stream.start();
 *   // stream.triggerEvent();   // manual valence shift
 *   // stream.getWindow();      // returns sliding window frames
 *   // stream.stop();
 */

// Fibonacci group weights — first N values determine group proportions.
// Groups sizes: [1,2,3,5,8,...] / total  (matches onboarding-v2)
const FIBS = [1, 2, 3, 5, 8, 13, 21];

function fibWeights(numGroups) {
  return FIBS.slice(0, numGroups);
}

/** Assign participant at normalized position `pos` (0..1) to a group index. */
function assignGroup(pos, numGroups) {
  const weights = fibWeights(numGroups);
  const total = weights.reduce((a, b) => a + b, 0);
  let cum = 0;
  for (let g = 0; g < numGroups; g++) {
    cum += weights[g] / total;
    if (pos < cum) return g;
  }
  return numGroups - 1;
}

/** Random value in [-1, +1] */
function randomVal() {
  return Math.random() * 2 - 1;
}

/** Clamp to [-1, +1] */
function clamp1(v) {
  return Math.max(-1, Math.min(1, v));
}

class ValenceStream extends EventTarget {
  /**
   * @param {object} opts
   * @param {number} [opts.numGroups=3]           Number of opinion groups
   * @param {number} [opts.numParticipants=50]    Number of simulated participants
   * @param {number} [opts.eventIntervalSeconds=8] Seconds between auto valence shifts
   * @param {number} [opts.noiseAmount=0.12]      Per-participant noise magnitude (±)
   * @param {number} [opts.driftSpeed=0.02]       Lerp factor per tick toward group target
   * @param {number} [opts.windowMinutes=5]       Sliding window history length in minutes
   * @param {number} [opts.tickRateHz=10]         Ticks per second
   */
  constructor(opts = {}) {
    super();
    this.numGroups            = opts.numGroups            ?? 3;
    this.numParticipants      = opts.numParticipants      ?? 50;
    this.eventIntervalSeconds = opts.eventIntervalSeconds ?? 8;
    this.noiseAmount          = opts.noiseAmount          ?? 0.12;
    this.driftSpeed           = opts.driftSpeed           ?? 0.02;
    this.windowMinutes        = opts.windowMinutes        ?? 5;
    this.tickRateHz           = opts.tickRateHz           ?? 10;

    this._tickMs       = 1000 / this.tickRateHz;
    this._timerId      = null;
    this._eventTimer   = 0;   // seconds elapsed since last event
    this._window       = [];  // sliding buffer of frame objects
    this._windowMs     = this.windowMinutes * 60 * 1000;

    this._groupTargets = [];
    this._participants = [];
    this._init();
  }

  // ── Initialisation ──────────────────────────────────────────

  _init() {
    const { numGroups, numParticipants, noiseAmount } = this;

    // Each group gets a random target in [-1, +1]
    this._groupTargets = Array.from({ length: numGroups }, () => randomVal());

    // Build participants, Fibonacci-proportionally assigned to groups
    this._participants = Array.from({ length: numParticipants }, (_, i) => {
      const group = assignGroup((i + 0.5) / numParticipants, numGroups);
      const noiseOffset = (Math.random() - 0.5) * 2 * noiseAmount;
      const target = clamp1(this._groupTargets[group] + noiseOffset);
      return {
        id: i,
        group,
        noiseOffset,
        value: (Math.random() - 0.5) * 0.3, // start near zero
        target,
      };
    });
  }

  // ── Public API ──────────────────────────────────────────────

  /** Start the stream. */
  start() {
    if (this._timerId !== null) return;
    this._timerId = setInterval(() => this._tick(), this._tickMs);
  }

  /** Stop the stream. */
  stop() {
    if (this._timerId === null) return;
    clearInterval(this._timerId);
    this._timerId = null;
  }

  /** Manually fire a valence shift event immediately. */
  triggerEvent() {
    this._fireEvent();
    this._eventTimer = 0;
  }

  /**
   * Returns all frames currently in the sliding window.
   * Each frame: { timestamp, participants: [{id, group, value}], eventFired }
   */
  getWindow() {
    return this._window.slice();
  }

  /**
   * Update configuration at runtime.
   * Changing numGroups or numParticipants reinitialises the simulation.
   * @param {Partial<ConstructorParameters<typeof ValenceStream>[0]>} opts
   */
  configure(opts) {
    let needsReinit = false;
    if (opts.numGroups !== undefined && opts.numGroups !== this.numGroups) {
      this.numGroups = opts.numGroups; needsReinit = true;
    }
    if (opts.numParticipants !== undefined && opts.numParticipants !== this.numParticipants) {
      this.numParticipants = opts.numParticipants; needsReinit = true;
    }
    if (opts.eventIntervalSeconds !== undefined) this.eventIntervalSeconds = opts.eventIntervalSeconds;
    if (opts.noiseAmount !== undefined) { this.noiseAmount = opts.noiseAmount; needsReinit = true; }
    if (opts.driftSpeed !== undefined) this.driftSpeed = opts.driftSpeed;
    if (opts.windowMinutes !== undefined) {
      this.windowMinutes = opts.windowMinutes;
      this._windowMs = opts.windowMinutes * 60 * 1000;
    }
    if (opts.tickRateHz !== undefined) {
      this.tickRateHz = opts.tickRateHz;
      this._tickMs = 1000 / opts.tickRateHz;
      if (this._timerId !== null) { this.stop(); this.start(); }
    }
    if (needsReinit) this._init();
  }

  // ── Internal ────────────────────────────────────────────────

  _tick() {
    const dt = this._tickMs / 1000;  // seconds elapsed this tick
    this._eventTimer += dt;

    let eventFired = false;
    if (this._eventTimer >= this.eventIntervalSeconds) {
      this._fireEvent();
      this._eventTimer = 0;
      eventFired = true;
    }

    // Drift each participant toward its group target + noise
    for (const p of this._participants) {
      const groupTarget = this._groupTargets[Math.min(p.group, this._groupTargets.length - 1)];
      p.target = clamp1(groupTarget + p.noiseOffset);
      p.value  = clamp1(p.value + (p.target - p.value) * this.driftSpeed);
    }

    const timestamp = Date.now();
    const frame = {
      timestamp,
      eventFired,
      participants: this._participants.map(p => ({ id: p.id, group: p.group, value: p.value })),
    };

    // Maintain sliding window
    this._window.push(frame);
    const cutoff = timestamp - this._windowMs;
    while (this._window.length > 0 && this._window[0].timestamp < cutoff) {
      this._window.shift();
    }

    this.dispatchEvent(new CustomEvent('frame', { detail: frame }));
  }

  _fireEvent() {
    const { numGroups } = this;
    this._groupTargets = Array.from({ length: numGroups }, () => randomVal());

    const timestamp = Date.now();
    this.dispatchEvent(new CustomEvent('event', {
      detail: { timestamp, groupTargets: this._groupTargets.slice() },
    }));
  }
}

// ── Export ─────────────────────────────────────────────────────────────────

// Support both ES module import and plain <script> tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValenceStream };
} else if (typeof window !== 'undefined') {
  window.ValenceStream = ValenceStream;
}
