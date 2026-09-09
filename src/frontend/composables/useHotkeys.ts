import { useMagicKeys, whenever } from '@vueuse/core';
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

  // Cmd+K or Ctrl+K - Open the command palette. Unlike the bare-key shortcuts
  // below, a modifier combo is safe to fire while an input has focus.
  //
  // Only opens. Once the palette is up, Cmd+K belongs to it -- that is how you
  // reach the highlighted item's actions -- and this listener is on window, so
  // without the guard it would close the palette out from under that gesture.
  // Escape and the global hotkey still close it.
  const openPalette = () => {
    if (palette.isOpen.value) return;
    palette.open();
  };

  whenever(keys['Meta+K'], openPalette);
  whenever(keys['Ctrl+K'], openPalette);

  // Add more global hotkeys here in the future
};
