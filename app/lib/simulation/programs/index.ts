// Registry of selectable simulation programs. The demo-page control bar reads
// PROGRAMS to build its dropdown and instantiate the chosen program.

import type { SimulationProgram } from '../types';
import { createDriftProgram } from './drift';
import { createRegionHoppersProgram } from './regionHoppers';
import { createRecordedPlaybackProgram, isRecordingAvailable } from './recordedPlayback';

/** A selectable program: stable id, human label, factory, and optional gating. */
export interface ProgramEntry {
  id: string;
  label: string;
  create: () => SimulationProgram;
  /** Optional async probe; if it resolves false the option is disabled. */
  checkAvailable?: () => Promise<boolean>;
  /** Tooltip shown when the program is unavailable. */
  unavailableHint?: string;
  /** True when the user-count control is meaningless (e.g. a fixed recording). */
  ignoresUserCount?: boolean;
}

/** All programs offered on the demo pages. Order is the dropdown order. */
export const PROGRAMS: ProgramEntry[] = [
  { id: 'drift', label: 'Drift / Wander', create: createDriftProgram },
  { id: 'region-hoppers', label: 'Region-hoppers', create: createRegionHoppersProgram },
  {
    id: 'recorded',
    label: 'Recorded playback',
    create: createRecordedPlaybackProgram,
    checkAvailable: isRecordingAvailable,
    unavailableHint: 'Sample recording not found (public/sim-recordings/sample.json)',
    ignoresUserCount: true, // crowd size is fixed by the recording
  },
];
