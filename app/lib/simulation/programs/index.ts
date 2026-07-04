// Registry of selectable simulation programs. The demo-page control bar reads
// PROGRAMS to build its dropdown and instantiate the chosen program.

import type { SimulationProgram } from '../types';
import { createDriftProgram } from './drift';
import { createRegionHoppersProgram } from './regionHoppers';

/** A selectable program: stable id, human label, and a factory. */
export interface ProgramEntry {
  id: string;
  label: string;
  create: () => SimulationProgram;
}

/** All programs offered on the demo pages. Order is the dropdown order. */
export const PROGRAMS: ProgramEntry[] = [
  { id: 'drift', label: 'Drift / Wander', create: createDriftProgram },
  { id: 'region-hoppers', label: 'Region-hoppers', create: createRegionHoppersProgram },
];
