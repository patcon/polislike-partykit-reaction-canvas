import { createContext, useContext } from "react";
import type { GreeterConfig } from "./types";

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
