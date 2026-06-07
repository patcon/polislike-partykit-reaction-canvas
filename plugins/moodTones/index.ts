import type { PanelPlugin } from '../types';
import MoodTonesComponent from './component';

const moodTonesPlugin: PanelPlugin = {
  id: 'mood-tones',
  label: 'Mood Tones',
  description: 'Generative audio keyed to audience reactions',
  patchable: true,
  activityMode: true,
  component: MoodTonesComponent,
};

export default moodTonesPlugin;
