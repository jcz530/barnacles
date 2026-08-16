import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import App from './App.vue';
import './assets/css/main.css';
import router from './router';

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

// Create and mount Vue app
const app = createApp(App);
app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.mount('#app');
