import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRef } from 'vue';
import { computed, unref } from 'vue';
import { API_ROUTES } from '../../shared/constants';
import type {
  ApiResponse,
  DetectedIDE,
  DetectedTerminal,
  HelloResponse,
  IDE,
  ProjectWithDetails,
  Setting,
  Technology,
  Terminal,
  User,
} from '../../shared/types/api';
import { useApi } from './useApi';

/* global URLSearchParams */

export const useQueries = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();

  // Hello API query
  const useHelloQuery = () => {
    return useQuery({
      queryKey: ['hello'],
      queryFn: () => apiCall<HelloResponse>('GET', API_ROUTES.HELLO),
      enabled: false, // Manual trigger
    });
  };

  // Users API query
  const useUsersQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['users'],
      queryFn: () => apiCall<User[]>('GET', API_ROUTES.USERS),
      enabled: options?.enabled ?? false, // Manual trigger by default
    });
  };

  // Health check query
  const useHealthQuery = () => {
    return useQuery({
      queryKey: ['health'],
      queryFn: () => apiCall('GET', '/api/health'),
      enabled: false, // Manual trigger
    });
  };

  // Projects API query
  const useProjectsQuery = (options?: {
    enabled?: boolean;
    search?: MaybeRef<string>;
    technologies?: MaybeRef<string[]>;
    includeArchived?: MaybeRef<boolean>;
  }) => {
    return useQuery({
      queryKey: computed(
        () =>
          [
            'projects',
            {
              search: unref(options?.search),
              technologies: unref(options?.technologies),
              includeArchived: unref(options?.includeArchived),
            },
          ] as const
      ),
      queryFn: async () => {
        const params = new URLSearchParams();

        const search = unref(options?.search);
        const technologies = unref(options?.technologies);
        const includeArchived = unref(options?.includeArchived);

        if (search) params.append('search', search);
        if (technologies && technologies.length > 0)
          params.append('technologies', technologies.join(','));
        if (includeArchived) params.append('includeArchived', 'true');

        const query = params.toString() ? `?${params.toString()}` : '';

        const response = await apiCall<ApiResponse<ProjectWithDetails[]>>(
          'GET',
          `${API_ROUTES.PROJECTS}${query}`
        );

        if (!response) {
          throw new Error('Failed to fetch projects');
        }

        return response.data || [];
      },
      enabled: options?.enabled ?? true,
    });
  };

  // Single project query
  const useProjectQuery = (projectId: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['project', unref(projectId)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<ProjectWithDetails>>(
          'GET',
          `${API_ROUTES.PROJECTS}/${unref(projectId)}`
        );

        if (!response) {
          throw new Error('Failed to fetch project');
        }

        return response.data;
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    });
  };

  // Technologies query
  const useTechnologiesQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['technologies'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Technology[]>>(
          'GET',
          API_ROUTES.PROJECTS_TECHNOLOGIES
        );

        if (!response) {
          throw new Error('Failed to fetch technologies');
        }

        return response.data || [];
      },
      enabled: options?.enabled ?? true,
    });
  };

  // Scan projects mutation
  const useScanProjectsMutation = () => {
    return useMutation({
      mutationFn: async (options?: { directories?: string[]; maxDepth?: number }) => {
        const response = await apiCall<ApiResponse<ProjectWithDetails[]>>(
          'POST',
          API_ROUTES.PROJECTS_SCAN,
          options
        );

        if (!response) {
          throw new Error('Failed to scan projects');
        }

        return response.data || [];
      },
      onSuccess: () => {
        // Invalidate projects query to refetch
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      },
    });
  };

  // Delete project mutation
  const useDeleteProjectMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        await apiCall('DELETE', `${API_ROUTES.PROJECTS}/${projectId}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      },
    });
  };

  // Rescan project mutation
  const useRescanProjectMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        const response = await apiCall<ApiResponse<ProjectWithDetails>>(
          'POST',
          `${API_ROUTES.PROJECTS}/${projectId}/rescan`
        );

        if (!response) {
          throw new Error('Failed to rescan project');
        }

        return response.data;
      },
      onSuccess: (data, projectId) => {
        // Invalidate both the projects list and the specific project query
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Toggle project favorite mutation
  const useToggleFavoriteMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        const response = await apiCall<ApiResponse<{ isFavorite: boolean }>>(
          'PATCH',
          `${API_ROUTES.PROJECTS}/${projectId}/favorite`
        );

        if (!response) {
          throw new Error('Failed to toggle favorite');
        }

        return response.data;
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Archive project mutation
  const useArchiveProjectMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        await apiCall('PATCH', `${API_ROUTES.PROJECTS}/${projectId}/archive`);
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Unarchive project mutation
  const useUnarchiveProjectMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        await apiCall('PATCH', `${API_ROUTES.PROJECTS}/${projectId}/unarchive`);
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Get detected IDEs query
  const useDetectedIDEsQuery = () => {
    return useQuery({
      queryKey: ['ides', 'detected'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<DetectedIDE[]>>(
          'GET',
          API_ROUTES.PROJECTS_IDES_DETECTED
        );

        if (!response) {
          throw new Error('Failed to fetch detected IDEs');
        }

        return response.data || [];
      },
    });
  };

  // Get available IDEs query
  const useAvailableIDEsQuery = () => {
    return useQuery({
      queryKey: ['ides', 'available'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<IDE[]>>(
          'GET',
          API_ROUTES.PROJECTS_IDES_AVAILABLE
        );

        if (!response) {
          throw new Error('Failed to fetch available IDEs');
        }

        return response.data || [];
      },
    });
  };

  // Update preferred IDE mutation
  const useUpdatePreferredIDEMutation = () => {
    return useMutation({
      mutationFn: async ({ projectId, ideId }: { projectId: string; ideId: string | null }) => {
        const response = await apiCall<ApiResponse>(
          'PATCH',
          `${API_ROUTES.PROJECTS}/${projectId}/ide`,
          { ideId }
        );

        if (!response) {
          throw new Error('Failed to update preferred IDE');
        }

        return response;
      },
      onSuccess: (data, { projectId }) => {
        // Invalidate both the projects list and the specific project query
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Open project in IDE mutation
  const useOpenProjectMutation = () => {
    return useMutation({
      mutationFn: async ({ projectId, ideId }: { projectId: string; ideId?: string }) => {
        const response = await apiCall<ApiResponse>(
          'POST',
          `${API_ROUTES.PROJECTS}/${projectId}/open`,
          ideId ? { ideId } : {}
        );

        if (!response) {
          throw new Error('Failed to open project');
        }

        return response;
      },
    });
  };

  // Get detected terminals query
  const useDetectedTerminalsQuery = () => {
    return useQuery({
      queryKey: ['terminals', 'detected'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<DetectedTerminal[]>>(
          'GET',
          API_ROUTES.PROJECTS_TERMINALS_DETECTED
        );

        if (!response) {
          throw new Error('Failed to fetch detected terminals');
        }

        return response.data || [];
      },
    });
  };

  // Get available terminals query
  const useAvailableTerminalsQuery = () => {
    return useQuery({
      queryKey: ['terminals', 'available'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Terminal[]>>(
          'GET',
          API_ROUTES.PROJECTS_TERMINALS_AVAILABLE
        );

        if (!response) {
          throw new Error('Failed to fetch available terminals');
        }

        return response.data || [];
      },
    });
  };

  // Update preferred terminal mutation
  const useUpdatePreferredTerminalMutation = () => {
    return useMutation({
      mutationFn: async ({
        projectId,
        terminalId,
      }: {
        projectId: string;
        terminalId: string | null;
      }) => {
        const response = await apiCall<ApiResponse>(
          'PATCH',
          `${API_ROUTES.PROJECTS}/${projectId}/terminal`,
          { terminalId }
        );

        if (!response) {
          throw new Error('Failed to update preferred terminal');
        }

        return response;
      },
      onSuccess: (data, { projectId }) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Open terminal at project mutation
  const useOpenTerminalMutation = () => {
    return useMutation({
      mutationFn: async ({ projectId, terminalId }: { projectId: string; terminalId?: string }) => {
        const response = await apiCall<ApiResponse>(
          'POST',
          `${API_ROUTES.PROJECTS}/${projectId}/open-terminal`,
          terminalId ? { terminalId } : {}
        );

        if (!response) {
          throw new Error('Failed to open terminal');
        }

        return response;
      },
    });
  };

  // Project README query
  const useProjectReadmeQuery = (projectId: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['project-readme', unref(projectId)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<string>>(
          'GET',
          `${API_ROUTES.PROJECTS}/${unref(projectId)}/readme`
        );

        // Return null if README not found (404) or any other error
        if (!response) {
          return null;
        }

        return response.data || null;
      },
      enabled: options?.enabled ?? true,
    });
  };

  // Project package.json scripts query
  const useProjectPackageScriptsQuery = (
    projectId: MaybeRef<string>,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: ['project-package-scripts', unref(projectId)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Record<string, string>>>(
          'GET',
          `${API_ROUTES.PROJECTS}/${unref(projectId)}/package-scripts`
        );

        if (!response) {
          return {};
        }

        return response.data || {};
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    });
  };

  // Project composer.json scripts query
  const useProjectComposerScriptsQuery = (
    projectId: MaybeRef<string>,
    options?: { enabled?: boolean }
  ) => {
    return useQuery({
      queryKey: ['project-composer-scripts', unref(projectId)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Record<string, string>>>(
          'GET',
          `${API_ROUTES.PROJECTS}/${unref(projectId)}/composer-scripts`
        );

        if (!response) {
          return {};
        }

        return response.data || {};
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    });
  };

  // Settings queries
  const useSettingsQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['settings'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Setting[]>>('GET', API_ROUTES.SETTINGS);

        if (!response) {
          throw new Error('Failed to fetch settings');
        }

        return response.data || [];
      },
      enabled: options?.enabled ?? true,
    });
  };

  const useSettingQuery = (key: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['setting', unref(key)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Setting>>(
          'GET',
          API_ROUTES.SETTINGS_KEY(unref(key))
        );

        if (!response) {
          throw new Error('Failed to fetch setting');
        }

        return response.data;
      },
      enabled: options?.enabled ?? true,
    });
  };

  const useUpdateSettingMutation = () => {
    return useMutation({
      mutationFn: async (params: {
        key: string;
        value: string | number | boolean | object;
        type?: 'string' | 'number' | 'boolean' | 'json';
      }) => {
        const response = await apiCall<ApiResponse<Setting>>(
          'PUT',
          API_ROUTES.SETTINGS_KEY(params.key),
          { value: params.value, type: params.type }
        );

        if (!response) {
          throw new Error('Failed to update setting');
        }

        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['settings'] });
      },
    });
  };

  // Delete third-party packages mutation
  const useDeleteThirdPartyPackagesMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        const response = await apiCall<ApiResponse<{ deletedSize: number }>>(
          'POST',
          `${API_ROUTES.PROJECTS}/${projectId}/delete-packages`
        );

        if (!response) {
          throw new Error('Failed to delete packages');
        }

        return response.data;
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Get start processes configuration query
  const useStartProcessesQuery = (projectId: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: computed(() => ['project', unref(projectId), 'start-processes'] as const),
      queryFn: async () => {
        const id = unref(projectId);
        const response = await apiCall<ApiResponse<unknown[]>>(
          'GET',
          API_ROUTES.PROJECTS_START_PROCESSES(id)
        );

        if (!response) {
          throw new Error('Failed to fetch start processes');
        }

        return response.data;
      },
      enabled: options?.enabled ?? true,
      staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    });
  };

  // Update start processes configuration mutation
  const useUpdateStartProcessesMutation = () => {
    return useMutation({
      mutationFn: async ({
        projectId,
        startProcesses,
      }: {
        projectId: string;
        startProcesses: unknown[];
      }) => {
        const response = await apiCall<ApiResponse<void>>(
          'PATCH',
          API_ROUTES.PROJECTS_START_PROCESSES(projectId),
          { startProcesses }
        );

        if (!response) {
          throw new Error('Failed to update start processes');
        }

        return response.data;
      },
      onSuccess: (data, { projectId }) => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId, 'start-processes'] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      },
    });
  };

  // Start project processes mutation
  const useStartProjectProcessesMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        const response = await apiCall<ApiResponse<unknown>>(
          'POST',
          API_ROUTES.PROJECTS_START(projectId)
        );

        if (!response) {
          throw new Error('Failed to start project processes');
        }

        return response.data;
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId, 'process-status'] });
      },
    });
  };

  // Stop project processes mutation
  const useStopProjectProcessesMutation = () => {
    return useMutation({
      mutationFn: async (projectId: string) => {
        const response = await apiCall<ApiResponse<void>>(
          'POST',
          API_ROUTES.PROJECTS_STOP(projectId)
        );

        if (!response) {
          throw new Error('Failed to stop project processes');
        }

        return response.data;
      },
      onSuccess: (data, projectId) => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId, 'process-status'] });
      },
    });
  };

  // Get process status query (optionally filtered by projectId)
  const useProcessStatusQuery = (
    projectId?: MaybeRef<string>,
    options?: { enabled?: boolean; refetchInterval?: number }
  ) => {
    return useQuery({
      queryKey: computed(() =>
        projectId
          ? (['project', unref(projectId), 'process-status'] as const)
          : (['process-status-all'] as const)
      ),
      queryFn: async () => {
        const params = new URLSearchParams();
        const pid = projectId ? unref(projectId) : undefined;
        if (pid) params.append('projectId', pid);

        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiCall<ApiResponse<unknown>>(
          'GET',
          `${API_ROUTES.PROJECTS_PROCESS_STATUS}${query}`
        );

        if (!response) {
          throw new Error('Failed to fetch process status');
        }

        return response.data;
      },
      enabled: options?.enabled ?? false,
      refetchInterval: options?.refetchInterval ?? false,
    });
  };

  // Stop specific process mutation
  const useStopProcessMutation = () => {
    return useMutation({
      mutationFn: async ({ projectId, processId }: { projectId: string; processId: string }) => {
        const response = await apiCall<ApiResponse<void>>(
          'POST',
          API_ROUTES.PROJECTS_STOP_PROCESS(projectId, processId)
        );

        if (!response) {
          throw new Error('Failed to stop process');
        }

        return response.data;
      },
      onSuccess: (data, { projectId }) => {
        queryClient.invalidateQueries({ queryKey: ['project', projectId, 'process-status'] });
      },
    });
  };

  // Get process output query
  const useProcessOutputQuery = (
    projectId: MaybeRef<string>,
    processId: MaybeRef<string>,
    options?: { enabled?: MaybeRef<boolean>; refetchInterval?: number }
  ) => {
    return useQuery({
      queryKey: computed(
        () => ['project', unref(projectId), 'process', unref(processId), 'output'] as const
      ),
      queryFn: async () => {
        const pid = unref(projectId);
        const procId = unref(processId);
        const response = await apiCall<ApiResponse<{ output: string; lines: string[] }>>(
          'GET',
          API_ROUTES.PROJECTS_PROCESS_OUTPUT(pid, procId)
        );

        if (!response) {
          throw new Error('Failed to fetch process output');
        }

        return response.data;
      },
      enabled: computed(() => {
        const enabled = options?.enabled;
        return enabled ? unref(enabled) : true;
      }),
      refetchInterval: options?.refetchInterval ?? false,
    });
  };

  // Get all processes or filter by project (new unified API)
  const useProcessesQuery = (projectId?: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: projectId ? ['processes', unref(projectId)] : ['processes'],
      queryFn: async () => {
        const params = new URLSearchParams();
        const pid = unref(projectId);
        if (pid) params.append('projectId', pid);

        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await apiCall<ApiResponse<any[]>>(
          'GET',
          `${API_ROUTES.PROCESSES}${query}`
        );

        if (!response) {
          throw new Error('Failed to fetch processes');
        }

        return response.data || [];
      },
      enabled: options?.enabled ?? true,
      refetchInterval: 5000, // Auto-refresh every 5 seconds
    });
  };

  // Get a single process by ID
  const useProcessQuery = (processId: MaybeRef<string>, options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['process', unref(processId)],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<any>>(
          'GET',
          `${API_ROUTES.PROCESSES}/${unref(processId)}`
        );

        if (!response) {
          throw new Error('Failed to fetch process');
        }

        return response.data;
      },
      enabled: options?.enabled ?? true,
    });
  };

  // Create a new process (ad-hoc script run)
  const useCreateProcessMutation = () => {
    return useMutation({
      mutationFn: async (params: {
        cwd?: string;
        projectId?: string;
        command?: string;
        title?: string;
      }) => {
        const response = await apiCall<ApiResponse<any>>('POST', API_ROUTES.PROCESSES, params);

        if (!response) {
          throw new Error('Failed to create process');
        }

        return response.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['processes'] });
      },
    });
  };

  // Kill a process by ID
  const useKillProcessMutation = () => {
    return useMutation({
      mutationFn: async (processId: string) => {
        await apiCall('DELETE', `${API_ROUTES.PROCESSES}/${processId}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['processes'] });
      },
    });
  };

  // Get process output by ID
  const useProcessOutputByIdQuery = (
    processId: MaybeRef<string>,
    options?: { enabled?: MaybeRef<boolean>; refetchInterval?: number }
  ) => {
    return useQuery({
      queryKey: computed(() => ['process', unref(processId), 'output'] as const),
      queryFn: async () => {
        const procId = unref(processId);
        const response = await apiCall<ApiResponse<{ output: string; lines: string[] }>>(
          'GET',
          `${API_ROUTES.PROCESSES}/${procId}/output`
        );

        if (!response) {
          throw new Error('Failed to fetch process output');
        }

        return response.data;
      },
      enabled: computed(() => {
        const enabled = options?.enabled;
        return enabled ? unref(enabled) : true;
      }),
      refetchInterval: options?.refetchInterval ?? false,
    });
  };

  // Get hosts file entries
  const useHostsQuery = (options?: { enabled?: boolean }) => {
    return useQuery({
      queryKey: ['hosts'],
      queryFn: async () => {
        const response = await apiCall<ApiResponse<Array<{ ip: string; hostname: string }>>>(
          'GET',
          API_ROUTES.SYSTEM_HOSTS
        );

        if (!response) {
          throw new Error('Failed to fetch hosts');
        }

        return response.data || [];
      },
      enabled: options?.enabled ?? true,
    });
  };

  return {
    useHelloQuery,
    useUsersQuery,
    useHealthQuery,
    useProjectsQuery,
    useProjectQuery,
    useTechnologiesQuery,
    useScanProjectsMutation,
    useDeleteProjectMutation,
    useRescanProjectMutation,
    useToggleFavoriteMutation,
    useArchiveProjectMutation,
    useUnarchiveProjectMutation,
    useDetectedIDEsQuery,
    useAvailableIDEsQuery,
    useUpdatePreferredIDEMutation,
    useOpenProjectMutation,
    useDetectedTerminalsQuery,
    useAvailableTerminalsQuery,
    useUpdatePreferredTerminalMutation,
    useOpenTerminalMutation,
    useProjectReadmeQuery,
    useProjectPackageScriptsQuery,
    useProjectComposerScriptsQuery,
    useSettingsQuery,
    useSettingQuery,
    useUpdateSettingMutation,
    useDeleteThirdPartyPackagesMutation,
    useStartProcessesQuery,
    useUpdateStartProcessesMutation,
    useStartProjectProcessesMutation,
    useStopProjectProcessesMutation,
    useProcessStatusQuery,
    useStopProcessMutation,
    useProcessOutputQuery,
    useProcessesQuery,
    useProcessQuery,
    useCreateProcessMutation,
    useKillProcessMutation,
    useProcessOutputByIdQuery,
    useHostsQuery,
  };
};
