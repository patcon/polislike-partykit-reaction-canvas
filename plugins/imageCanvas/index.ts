import type { PanelPlugin } from '../types';
import ImageCanvasBackground from './background';
import ImageCanvasConfigModal from './configModal';

const imageCanvasPlugin: PanelPlugin = {
  id: 'image-canvas',
  label: 'Image Canvas',
  description: 'React over a shared background image',
  patchable: false,
  activityMode: true,
  canvasOverlay: {
    background: ImageCanvasBackground,
    canvasProps: { disableCursorValence: true, disableBackgroundValence: true },
  },
  configModal: ImageCanvasConfigModal,
};

export default imageCanvasPlugin;
