import type { PanelPlugin } from '../types';
import { stenoPlugin } from './steno/index';
import { storyTracerPlugin } from './storyTracer/index';

export default [stenoPlugin, storyTracerPlugin] as PanelPlugin[];
