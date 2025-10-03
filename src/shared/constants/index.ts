export const APP_CONFIG = {
  API_PORT_PREFERRED: 51000,
  API_HOST: 'localhost',
  WINDOW_SIZE: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  },
} as const;

// Runtime configuration that gets set during app initialization
export let RUNTIME_CONFIG = {
  API_PORT: 51000,
  API_BASE_URL: 'http://localhost:51000',
};

export const updateRuntimeConfig = (config: Partial<typeof RUNTIME_CONFIG>) => {
  RUNTIME_CONFIG = { ...RUNTIME_CONFIG, ...config };
};

export const API_ROUTES = {
  HELLO: '/api/hello',
  USERS: '/api/users',
} as const;
