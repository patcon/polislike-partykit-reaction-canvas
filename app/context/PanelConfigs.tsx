import { createContext, useContext } from "react";
import type { SocialConfig } from "../types";

// ── Social Media ───────────────────────────────────────────────────────────

interface SocialMediaConfigContextValue {
  socialMediaConfig: SocialConfig | null;
}
const SocialMediaConfigContext = createContext<SocialMediaConfigContextValue | null>(null);
export const SocialMediaConfigProvider = SocialMediaConfigContext.Provider;
export function useSocialMediaConfig(): SocialMediaConfigContextValue {
  const ctx = useContext(SocialMediaConfigContext);
  if (!ctx) throw new Error('useSocialMediaConfig() called outside SocialMediaConfigProvider');
  return ctx;
}

// ── Image Canvas ───────────────────────────────────────────────────────────

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
