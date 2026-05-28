import { createContext, useContext } from "react";

export interface PanelContextValue {
  room: string;
  userId: string;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export const PanelContextProvider = PanelContext.Provider;

export function usePanelContext(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanelContext() called outside PanelContextProvider');
  return ctx;
}
