import type { PanelPlugin } from '../types';
import { signatureServer } from './server';
import SignatureCanvasPanel from './component';

const signatureCanvasPlugin: PanelPlugin = {
  id: 'signature',
  label: 'Signature Canvas',
  description: 'Collect participant signatures live',
  patchable: false,
  activityMode: true,
  component: SignatureCanvasPanel,
  server: signatureServer,
};

export default signatureCanvasPlugin;
