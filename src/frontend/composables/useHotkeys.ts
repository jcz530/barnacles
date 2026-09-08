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

  // Cmd+K or Ctrl+K - Toggle the command palette. Unlike the bare-key shortcuts
  // below, a modifier combo is safe to fire while an input has focus.
  whenever(keys['Meta+K'], () => {
    palette.toggle();
  });
  whenever(keys['Ctrl+K'], () => {
    palette.toggle();
  });

  // Add more global hotkeys here in the future
};
