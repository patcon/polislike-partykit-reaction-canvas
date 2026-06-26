// Device capability helpers shared across apps and demo pages.

/** True on touch-capable devices (phones/tablets). */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
