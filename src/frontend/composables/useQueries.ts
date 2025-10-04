import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import type { MaybeRef } from 'vue';
import { unref } from 'vue';
import { API_ROUTES } from '../../shared/constants';
import type {
  ApiResponse,
  HelloResponse,
  ProjectWithDetails,
  Technology,
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
    status?: MaybeRef<'active' | 'archived'>;
  }) => {
    return useQuery({
      queryKey: [
        'projects',
        {
          search: unref(options?.search),
          technologies: unref(options?.technologies),
          status: unref(options?.status),
        },
      ],
      queryFn: async () => {
        const params = new URLSearchParams();

        const search = unref(options?.search);
        const technologies = unref(options?.technologies);
        const status = unref(options?.status);

        if (search) params.append('search', search);
        if (technologies && technologies.length > 0)
          params.append('technologies', technologies.join(','));
        if (status) params.append('status', status);

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

  // Update project status mutation
  const useUpdateProjectStatusMutation = () => {
    return useMutation({
      mutationFn: async (params: { projectId: string; status: 'active' | 'archived' }) => {
        await apiCall('PATCH', `${API_ROUTES.PROJECTS}/${params.projectId}/status`, {
          status: params.status,
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      },
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
    useUpdateProjectStatusMutation,
  };
};
