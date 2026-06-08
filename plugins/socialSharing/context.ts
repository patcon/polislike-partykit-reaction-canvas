import { createContext, useContext } from "react";
import type { SocialConfig } from "../../app/types";

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
