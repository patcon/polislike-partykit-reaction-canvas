import { useImageCanvasConfig } from './context';

export default function ImageCanvasBackground() {
  const { imageUrl } = useImageCanvasConfig();
  if (!imageUrl) return null;
  return <img src={imageUrl} className="image-canvas-bg" alt="" />;
}
