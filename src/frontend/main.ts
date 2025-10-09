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

// Create and mount Vue app
const app = createApp(App);
app.use(router);
app.use(VueQueryPlugin, { queryClient });
app.mount('#app');
