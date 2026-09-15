import { computed, ref, watch } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';
import { SETTING_KEYS, type Setting } from '@shared/types/api';

/**
 * The app-wide motion preference.
 *
 * Three values rather than a boolean, because a `prefers-reduced-motion` media
 * query can only be read, never set: 'system' defers to the OS, while 'always'
 * and 'never' override it in either direction. Components therefore cannot rely
 * on the media query alone -- they key off the `reduce-motion` class this puts
 * on the document root, with the query as the fallback in 'system' mode.
 *
 * State lives at module scope rather than in the settings query because
 * `useUpdateSettingMutation` deliberately does not invalidate `['settings']`
 * (invalidating fights the auto-save watchers). A shared ref is what keeps the
 * settings row and the rest of the app agreeing after a change.
 */
export type MotionPreference = 'system' | 'always' | 'never';

const MOTION_PREFERENCES: MotionPreference[] = ['system', 'always', 'never'];

export const isMotionPreference = (value: unknown): value is MotionPreference =>
  typeof value === 'string' && (MOTION_PREFERENCES as string[]).includes(value);

/** Shared so every caller sees the same value, not one copy per component. */
const preference = ref<MotionPreference>('system');

export function useReducedMotion() {
  const systemPrefersReduced = usePreferredReducedMotion();

  const isReduced = computed(() => {
    if (preference.value === 'always') return true;
    if (preference.value === 'never') return false;
    return systemPrefersReduced.value === 'reduce';
  });

  const setPreference = (next: MotionPreference) => {
    preference.value = next;
  };

  /**
   * Adopt the stored value. Called with the settings query's rows; anything
   * unrecognised leaves the current preference alone rather than resetting it,
   * so a bad row cannot silently turn motion back on.
   */
  const syncFromSettings = (rows: Setting[] | undefined) => {
    const stored = rows?.find(row => row.key === SETTING_KEYS.REDUCED_MOTION)?.value;
    if (isMotionPreference(stored)) {
      preference.value = stored;
    }
  };

  return { preference, isReduced, setPreference, syncFromSettings };
}

/**
 * Mirrors the preference onto the document root. Call once, at app root --
 * every other caller just reads `useReducedMotion()`.
 */
export function useReducedMotionRoot() {
  const { isReduced, syncFromSettings, preference: pref } = useReducedMotion();

  watch(
    [isReduced, pref],
    ([reduced, current]) => {
      const root = document.documentElement;
      root.classList.toggle('reduce-motion', reduced);
      // The explicit opt-out needs its own class: the components' fallback is a
      // `prefers-reduced-motion` media query, and nothing in CSS can switch a
      // media query off. `no-reduce-motion` is what 'never' uses to out-specify
      // it when the OS is asking to reduce.
      root.classList.toggle('no-reduce-motion', current === 'never');
    },
    { immediate: true }
  );

  return { isReduced, syncFromSettings, preference: pref };
}
