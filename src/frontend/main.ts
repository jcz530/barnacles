import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';
import './assets/css/main.css';
import router from './router';
import { updateRuntimeConfig } from '../shared/constants';

// Create QueryClient for TanStack Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Readiness signal for the screenshot capture script: it polls this instead of
// sleeping a fixed interval, so shots are taken once data has actually landed.
// Opt-in via ?screenshots=1 because the renderer cannot read process.env.
if (new URLSearchParams(window.location.search).has('screenshots')) {
  (window as unknown as { __bqIsFetching?: () => number }).__bqIsFetching = () =>
    queryClient.isFetching() + queryClient.isMutating();
}

/**
 * Teach this renderer which port its own API server landed on.
 *
 * RUNTIME_CONFIG is updated in the main process when the server binds, but the
 * renderer is a separate JS context, so its copy keeps the compiled-in default
 * of 51000. Anything building a URL from it -- project icons, README images,
 * the file viewer, port screenshots -- therefore points at 51000 no matter what
 * port this instance actually got.
 *
 * Usually invisible, because 51000 is the preferred port and requests to a
 * closed port merely fail. It bites when a second instance is running: a dev
 * build on 51001 asks 51000 for its images, which is the *other* app's server,
 * and the CSP (correctly scoped to this instance's port) blocks it.
 *
 * Done before mount so no component can read a stale base URL.
 */
const applyApiConfig = async (): Promise<void> => {
  try {
    const config = await window.electronAPI.getApiConfig();
    if (config?.port) {
      updateRuntimeConfig({
        API_PORT: config.port,
        API_BASE_URL: config.baseUrl ?? `http://localhost:${config.port}`,
      });
    }
  } catch {
    // Outside Electron (or before the bridge exists) the default stands; API
    // calls go over IPC and don't depend on this.
  }
};

// Create and mount Vue app
const app = createApp(App);
app.use(router);
app.use(VueQueryPlugin, { queryClient });

applyApiConfig().finally(() => {
  app.mount('#app');
});
