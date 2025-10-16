import { useMagicKeys, whenever } from '@vueuse/core';
import { useRouter } from 'vue-router';

export const useHotkeys = () => {
  const router = useRouter();
  const keys = useMagicKeys();

  // Cmd+, or Ctrl+, - Open Settings
  whenever(keys['Meta+Comma'], () => {
    void router.push('/settings');
  });
  whenever(keys['Ctrl+Comma'], () => {
    void router.push('/settings');
  });

  // Add more global hotkeys here in the future
};
