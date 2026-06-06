import { createContext, useContext } from "react";
import type { GreeterConfig, SocialConfig } from "../types";

// ── Greeter ────────────────────────────────────────────────────────────────

interface GreeterConfigContextValue {
  greeterConfig: GreeterConfig | null;
}
const GreeterConfigContext = createContext<GreeterConfigContextValue | null>(null);
export const GreeterConfigProvider = GreeterConfigContext.Provider;
export function useGreeterConfig(): GreeterConfigContextValue {
  const ctx = useContext(GreeterConfigContext);
  if (!ctx) throw new Error('useGreeterConfig() called outside GreeterConfigProvider');
  return ctx;
}

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
