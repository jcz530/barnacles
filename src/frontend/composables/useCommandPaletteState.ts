import { ref } from 'vue';

/**
 * Whether the in-app command palette is open.
 *
 * Module-level so the hotkey (registered in useHotkeys, called from the layout)
 * and the dialog (mounted in App.vue) share one source of truth without prop
 * drilling through the component tree between them.
 */
const isOpen = ref(false);

export const useCommandPaletteState = () => {
  const open = () => {
    isOpen.value = true;
  };
  const close = () => {
    isOpen.value = false;
  };
  const toggle = () => {
    isOpen.value = !isOpen.value;
  };

  return { isOpen, open, close, toggle };
};
