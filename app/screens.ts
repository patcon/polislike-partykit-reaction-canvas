/**
 * Participant "screens" — independently-controllable surfaces whose active panel
 * the emcee sets from the Interfaces tab. Single source of truth: add a screen
 * here and the chip bar, Interfaces-tab columns, share dialog, unlock logic, and
 * server lifecycle gate all pick it up.
 *
 * Pure data only (no React/DOM) so `party/server.ts` (workerd build) can import it.
 */
export interface ScreenDef {
  /** Wire/state key: screenPanels[name], screenPanelChanged.screenName, ?interface=<name> */
  name: string;
  /** Interfaces-tab column header. */
  label: string;
  /** Chip-bar label (feeds KNOWN_CHIPS). */
  chipLabel: string;
  /**
   * Runs server plugin lifecycle hooks (onActivate/onDeactivate). Exactly one
   * screen should set this. Panels with `needsLifecycle` can only mount on it.
   */
  lifecycle: boolean;
  /** Unlocked via ?interface=<name>, parallel to emcee. (personal is always present.) */
  urlPrivileged: boolean;
  /** Extra query params appended to this screen's share URL. */
  shareParams?: Record<string, string>;
}

export const SCREENS: ScreenDef[] = [
  { name: 'personal', label: 'Personal', chipLabel: 'Push Screen',
    lifecycle: true,  urlPrivileged: false },
  { name: 'commons',  label: 'Commons',  chipLabel: 'Commons Screen',
    lifecycle: false, urlPrivileged: true,  shareParams: { hideChipBar: 'true' } },
];

export const SCREEN_NAMES = SCREENS.map(s => s.name);

/** The one screen that runs plugin lifecycle hooks. */
export const LIFECYCLE_SCREEN = SCREENS.find(s => s.lifecycle)!.name;

export const isScreen = (id: string): boolean => SCREEN_NAMES.includes(id);
