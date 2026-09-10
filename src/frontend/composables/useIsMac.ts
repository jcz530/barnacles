import { computed, type ComputedRef } from 'vue';

/**
 * Whether this renderer is running on macOS.
 *
 * Shortcut hints are written differently per platform -- glyphs run together on
 * macOS, words joined by "+" elsewhere -- so anything rendering an accelerator
 * needs this.
 */
export const useIsMac = (): ComputedRef<boolean> =>
  computed(() => navigator.platform.toLowerCase().includes('mac'));
