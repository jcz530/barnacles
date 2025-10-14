import { ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { useProjectScanWebSocket } from './useProjectScanWebSocket';
import { useQueries } from './useQueries';

/**
 * Composable to detect if this is the first run of the app and trigger an initial scan
 */
export function useFirstRunDetection() {
  const hasChecked = ref(false);
  const { startScan } = useProjectScanWebSocket();
  const { useProjectsQuery } = useQueries();

  /**
   * Trigger the initial scan with UI feedback
   */
  const triggerInitialScan = () => {
    // Show welcome toast
    toast.info('Welcome to Barnacles!', {
      description: 'Starting initial project scan...',
      duration: 20000,
    });

    // Start the scan after a brief delay
    useTimeoutFn(() => {
      startScan();
    }, 1000);
  };

  /**
   * Check if this is the first run and trigger scan if needed
   */
  const checkFirstRun = () => {
    if (hasChecked.value) {
      return;
    }

    hasChecked.value = true;

    // Wait for the app to fully initialize before checking
    // Set up the projects query
    const { data, isSuccess } = useProjectsQuery({
      enabled: true,
      search: ref(''),
      technologies: ref([]),
    });

    // Watch for the query to complete
    watch(
      () => isSuccess.value,
      success => {
        if (success && data.value) {
          // Check if there are no projects
          if (data.value.length === 0) {
            triggerInitialScan();
          }
        }
      },
      { immediate: true }
    );
  };

  return {
    checkFirstRun,
    hasChecked,
  };
}
