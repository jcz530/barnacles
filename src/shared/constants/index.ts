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
  USERS_CURRENT: '/api/users/current',
  PROJECTS: '/api/projects',
  PROJECTS_TECHNOLOGIES: '/api/projects/meta/technologies',
  PROJECTS_IDES_DETECTED: '/api/projects/ides/detected',
  PROJECTS_IDES_AVAILABLE: '/api/projects/ides/available',
  PROJECTS_TERMINALS_DETECTED: '/api/projects/terminals/detected',
  PROJECTS_TERMINALS_AVAILABLE: '/api/projects/terminals/available',
  TERMINALS: '/api/terminals',
  TERMINALS_WS: '/api/terminals/ws',
  PROCESSES: '/api/processes',
  PROJECTS_PACKAGE_SCRIPTS: (id: string) => `/api/projects/${id}/package-scripts`,
  PROJECTS_START_PROCESSES: (id: string) => `/api/projects/${id}/start-processes`,
  PROJECTS_START: (id: string) => `/api/projects/${id}/start`,
  PROJECTS_STOP: (id: string) => `/api/projects/${id}/stop`,
  PROJECTS_PROCESS_STATUS: '/api/projects/process-status',
  PROJECTS_STOP_PROCESS: (id: string, processId: string) =>
    `/api/projects/${id}/processes/${processId}/stop`,
  PROJECTS_PROCESS_OUTPUT: (id: string, processId: string) =>
    `/api/projects/${id}/processes/${processId}/output`,
  SETTINGS: '/api/settings',
  SETTINGS_KEY: (key: string) => `/api/settings/${key}`,
  SETTINGS_RESET: '/api/settings/reset',
  SETTINGS_DEFAULTS: '/api/settings/defaults',
  SETTINGS_DEFAULTS_KEY: (key: string) => `/api/settings/defaults/${key}`,
  SYSTEM_HOSTS: '/api/system/hosts',
  SYSTEM_HOSTS_PATH: '/api/system/hosts/path',
  SYSTEM_DIRECTORIES_SEARCH: '/api/system/directories/search',
} as const;
