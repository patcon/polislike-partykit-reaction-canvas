import type { PanelPlugin } from '../../types';
import type { StoryTracerState } from '../types';
import StoryTracerPanel from './component';
import { storyTracerServer } from './server';

export const storyTracerPlugin: PanelPlugin<StoryTracerState> = {
  id: 'story-tracer',
  label: 'Story Tracer',
  description: 'Semantic 3D narrative path from VTT transcript',
  patchable: true,
  activityMode: true,
  component: StoryTracerPanel,
  server: storyTracerServer,
};
