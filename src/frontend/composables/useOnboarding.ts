import { useMutation, useQuery } from '@tanstack/vue-query';
import { API_ROUTES } from '../../shared/constants';
import { useApi } from './useApi';
import { useQueries } from './useQueries';
import { toast } from 'vue-sonner';

interface DiscoveredDirectory {
  path: string;
  exists: boolean;
  readable: boolean;
}

interface DiscoverDirectoriesResponse {
  directories: DiscoveredDirectory[];
  timestamp: string;
}

export const useOnboarding = (startScanFn: (options?: { directories?: string[] }) => void) => {
  const { apiCall } = useApi();
  const { useUpdateSettingMutation } = useQueries();

  /**
   * Discover existing project directories on the system
   */
  const useDiscoverDirectoriesQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['onboarding', 'discover-directories'],
      queryFn: async () => {
        const response = await apiCall<DiscoverDirectoriesResponse>(
          'GET',
          API_ROUTES.ONBOARDING_DISCOVER
        );
        return response?.directories ?? [];
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
    });
  };

  /**
   * Save selected directories and start scan
   */
  const useStartScanMutation = () => {
    const updateSettingMutation = useUpdateSettingMutation();

    return useMutation({
      mutationFn: async (params: { directories?: string[] }) => {
        // Save selected directories if provided
        if (params.directories && params.directories.length > 0) {
          await updateSettingMutation.mutateAsync({
            key: 'scanIncludedDirectories',
            value: params.directories,
            type: 'json',
          });
        }

        return { success: true, directories: params.directories };
      },
      onSuccess: data => {
        // Start scan - the WebSocket will handle invalidating queries as projects are discovered
        toast.info('Welcome to Barnacles!', {
          description: 'Starting initial project scan...',
          duration: 5000,
        });

        // Small delay to ensure settings are saved, then start scan with the directories
        setTimeout(() => {
          startScanFn({ directories: data.directories });
        }, 500);
      },
      onError: error => {
        console.error('Failed to start scan:', error);
        toast.error('Failed to start scan', {
          description: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      },
    });
  };

  return {
    useDiscoverDirectoriesQuery,
    useStartScanMutation,
  };
};
