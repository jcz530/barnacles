import { createApp } from 'vue';
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import './assets/css/main.css';

console.log('👋 Vue app starting in Electron renderer process');

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
