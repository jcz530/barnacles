import { useQuery } from '@tanstack/vue-query';
import { useApi } from './useApi';
import { API_ROUTES } from '../../shared/constants';
import type { HelloResponse, User } from '../../shared/types/api';

export const useQueries = () => {
  const { apiCall } = useApi();

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

  return {
    useHelloQuery,
    useUsersQuery,
    useHealthQuery,
  };
};
