export interface User {
  id: string;
  name: string;
  email: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  // Generic type with flexible default
  success: boolean;
  data?: T;
  error?: string;
}

export interface HelloResponse {
  message: string;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
