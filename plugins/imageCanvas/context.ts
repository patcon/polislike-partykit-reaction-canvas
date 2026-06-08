import { createContext, useContext } from "react";

interface ImageCanvasConfigContextValue {
  imageUrl: string;
}

const ImageCanvasConfigContext = createContext<ImageCanvasConfigContextValue | null>(null);
export const ImageCanvasConfigProvider = ImageCanvasConfigContext.Provider;

export function useImageCanvasConfig(): ImageCanvasConfigContextValue {
  const ctx = useContext(ImageCanvasConfigContext);
  if (!ctx) throw new Error('useImageCanvasConfig() called outside ImageCanvasConfigProvider');
  return ctx;
}
