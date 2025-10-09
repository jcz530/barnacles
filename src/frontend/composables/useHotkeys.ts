import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';

export const useHotkeys = () => {
  const router = useRouter();

  const handleKeydown = (event: KeyboardEvent) => {
    // Cmd+, or Ctrl+, - Open Settings
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      router.push('/settings');
      return;
    }

    // Add more hotkeys here in the future
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
};
