import { useMagicKeys, whenever } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { RouteNames } from '@/router';

export const useHotkeys = () => {
  const router = useRouter();
  const keys = useMagicKeys();

  // Cmd+, or Ctrl+, - Open Settings
  whenever(keys['Meta+Comma'], () => {
    void router.push({ name: RouteNames.Settings });
  });
  whenever(keys['Ctrl+Comma'], () => {
    void router.push({ name: RouteNames.Settings });
  });

  // Add more global hotkeys here in the future
};
