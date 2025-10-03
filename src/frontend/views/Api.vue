<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { onMounted } from 'vue';
import Button from '../components/ui/button/Button.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useQueries } from '../composables/useQueries';

const { setBreadcrumbs } = useBreadcrumbs();

onMounted(() => {
  setBreadcrumbs([{ label: 'API' }]);
});
const { useHelloQuery, useUsersQuery, useHealthQuery } = useQueries();

const helloQuery = useHelloQuery();
const usersQuery = useUsersQuery();
const healthQuery = useHealthQuery();

const fetchHello = () => helloQuery.refetch();
const fetchUsers = () => usersQuery.refetch();
const fetchHealth = () => healthQuery.refetch();
</script>

<template>
  <div class="mx-auto w-full p-8 md:p-4">
    <div class="flex flex-col gap-8">
      <h1 class="mb-4 text-center text-4xl font-bold text-slate-800 md:text-3xl">API Demo</h1>

      <Card class="bg-blue-50/50">
        <CardContent class="pt-6">
          <p class="text-slate-700">
            This page demonstrates the API architecture. The Vue frontend communicates with a Hono
            backend server running on
            <code class="rounded bg-slate-200 px-1 py-0.5">localhost:3001</code>. All API requests
            use <strong>TanStack Query</strong> for efficient data fetching, caching, and state
            management. The backend runs alongside Electron's main process, providing a REST API
            that the renderer process accesses via standard HTTP requests.
          </p>
        </CardContent>
      </Card>

      <!-- Hello API Section -->
      <Card>
        <CardHeader>
          <CardTitle>Hello API</CardTitle>
          <CardDescription>Test the basic hello endpoint</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Button :loading="helloQuery.isFetching.value" @click="fetchHello">
            Test Hello API
          </Button>

          <div v-if="helloQuery.error.value" class="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 class="mb-2 font-semibold text-red-800">Error:</h3>
            <p class="text-red-700">{{ helloQuery.error.value }}</p>
          </div>

          <div v-if="helloQuery.data.value" class="rounded-lg bg-slate-50 p-4">
            <h3 class="mb-2 font-semibold text-slate-800">Response:</h3>
            <pre class="overflow-x-auto text-sm">{{
              JSON.stringify(helloQuery.data.value, null, 2)
            }}</pre>
          </div>
        </CardContent>
      </Card>

      <!-- Users API Section -->
      <Card>
        <CardHeader>
          <CardTitle>Users API</CardTitle>
          <CardDescription>Fetch the list of users</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Button :loading="usersQuery.isFetching.value" @click="fetchUsers"> Fetch Users </Button>

          <div v-if="usersQuery.error.value" class="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 class="mb-2 font-semibold text-red-800">Error:</h3>
            <p class="text-red-700">{{ usersQuery.error.value }}</p>
          </div>

          <div v-if="usersQuery.data.value" class="rounded-lg bg-slate-50 p-4">
            <h3 class="mb-2 font-semibold text-slate-800">Response:</h3>
            <pre class="overflow-x-auto text-sm">{{
              JSON.stringify(usersQuery.data.value, null, 2)
            }}</pre>
          </div>
        </CardContent>
      </Card>

      <!-- Health Check Section -->
      <Card>
        <CardHeader>
          <CardTitle>Health Check</CardTitle>
          <CardDescription>Check the API server health status</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Button
            :loading="healthQuery.isFetching.value"
            @click="fetchHealth"
            variant="destructive"
          >
            Health Check
          </Button>

          <div
            v-if="healthQuery.error.value"
            class="rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <h3 class="mb-2 font-semibold text-red-800">Error:</h3>
            <p class="text-red-700">{{ healthQuery.error.value }}</p>
          </div>

          <div v-if="healthQuery.data.value" class="rounded-lg bg-slate-50 p-4">
            <h3 class="mb-2 font-semibold text-slate-800">Response:</h3>
            <pre class="overflow-x-auto text-sm">{{
              JSON.stringify(healthQuery.data.value, null, 2)
            }}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
