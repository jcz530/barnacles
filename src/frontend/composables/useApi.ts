import { ref } from 'vue';
import type { ApiMethod } from '../../shared/types/api';
import '../../shared/types/electron';

export const useApi = () => {
  const loading = ref(false);
  const error = ref<string>('');

  const apiCall = async <T = unknown>(
    method: ApiMethod,
    path: string,
    body?: unknown
  ): Promise<T | null> => {
    try {
      loading.value = true;
      error.value = '';

      const response = await window.electronAPI.apiCall(method, path, body);
      return response;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const clearError = () => {
    error.value = '';
  };

  return {
    loading,
    error,
    apiCall,
    clearError,
  };
};
