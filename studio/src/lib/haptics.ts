// A tiny buzz on Android phones when something important happens, so staff
// feel that a tap registered without looking. iPhones ignore vibrate().

const patterns = {
  tap: 8,
  success: [12, 60, 18],
  warning: [30, 40, 30],
} as const;

export function haptic(kind: keyof typeof patterns = 'tap'): void {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(patterns[kind] as number | number[]);
  } catch {
    // Not supported: nothing to do.
  }
}
