import { useEventListener, useMagicKeys, whenever } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { RouteNames } from '@/router';
import { useCommandPaletteState } from '@/composables/useCommandPaletteState';

export const useHotkeys = () => {
  const router = useRouter();
  const keys = useMagicKeys();
  const palette = useCommandPaletteState();

  // Cmd+, or Ctrl+, - Open Settings
  whenever(keys['Meta+Comma'], () => {
    void router.push({ name: RouteNames.Settings });
  });
  whenever(keys['Ctrl+Comma'], () => {
    void router.push({ name: RouteNames.Settings });
  });

  /*
   * Cmd+K or Ctrl+K - Toggle the command palette.
   *
   * It toggles because the palette no longer binds the combo itself: reaching a
   * row's actions is the right arrow or tab now, so the same keystroke that
   * opened the palette can close it again.
   *
   * Listened for directly rather than through useMagicKeys. That tracks which
   * keys are down and fires when the combination becomes true, so holding Cmd
   * and pressing K a second time never re-fires -- the combination was already
   * true and never went false in between. A keydown is the gesture itself, and
   * repeats regardless of what is still being held.
   *
   * A modifier combo is safe to bind while an input has focus, unlike the
   * bare-key shortcuts above.
   */
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key !== 'k' && event.key !== 'K') return;
    if (!event.metaKey && !event.ctrlKey) return;
    // Let the OS keep Cmd+Alt+K and friends; only the plain combo is ours.
    if (event.altKey || event.shiftKey) return;
    // Holding the key down repeats the event; one press is one toggle.
    if (event.repeat) return;

    event.preventDefault();
    palette.toggle();
  });

  // Add more global hotkeys here in the future
};
