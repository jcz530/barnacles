interface AppConfig {
  appName: string;
  appEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export function useConfigs(): AppConfig {
  return {
    appName: import.meta.env.VITE_APP_NAME || 'Barnacles',
    appEnv: import.meta.env.VITE_APP_ENV || 'development',
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}
