import type { PanelPlugin } from '../types';
import VoiceCallPanel from './component';
import VoiceCallConfigModal from './configModal';
import { VoiceCallServerPlugin } from './server';
import type { VoiceCallPluginState } from './types';

const voiceCallPlugin: PanelPlugin<VoiceCallPluginState> = {
  id: 'voice-call',
  label: 'Voice Calls',
  description: 'Peer-to-peer voice calls via WebRTC',
  patchable: true,
  activityMode: true,
  requiresHttps: true,
  component: VoiceCallPanel,
  configModal: VoiceCallConfigModal,
  server: VoiceCallServerPlugin,
};

export default voiceCallPlugin;
