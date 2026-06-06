import { useImageCanvasConfig } from '../../app/context/PanelConfigs';

export default function ImageCanvasBackground() {
  const { imageUrl } = useImageCanvasConfig();
  if (!imageUrl) return null;
  return <img src={imageUrl} className="image-canvas-bg" alt="" />;
}
