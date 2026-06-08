import type { PanelPlugin } from '../types';
import { SocialSharingServerPlugin } from './server';
import type { SocialSharingPluginState } from './types';
import SocialSharingComponent from './component';
import SocialSharingConfigModal from './configModal';

const socialSharingPlugin: PanelPlugin<SocialSharingPluginState> = {
  id: 'social-sharing',
  label: 'Social Sharing',
  description: 'Bluesky · Twitter / X · Mastodon',
  patchable: true,
  activityMode: true,
  component: SocialSharingComponent,
  configModal: SocialSharingConfigModal,
  server: SocialSharingServerPlugin,
};

export default socialSharingPlugin;
