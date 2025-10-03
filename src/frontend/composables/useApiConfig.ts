import { ref, onMounted } from 'vue';
import type { ApiConfig } from '../../shared/types/electron';

export const useApiConfig = () => {
  const config = ref<ApiConfig | null>(null);
  const loading = ref(true);
  const error = ref<string>('');

  const fetchConfig = async () => {
    try {
      loading.value = true;
      error.value = '';
      config.value = await window.electronAPI.getApiConfig();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to get API config';
      config.value = null;
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    fetchConfig();
  });

  return {
    config,
    loading,
    error,
    fetchConfig,
  };
};
