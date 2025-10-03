<script setup lang="ts">
import { ref } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const appInfo = ref({
  name: 'Electron + Hono + Vue App',
  version: '1.0.0',
  description: 'A modern Electron application built with Vue 3, Hono API, and TypeScript',
  features: [
    'Electron + Vue 3 + TypeScript',
    'Hono REST API backend on localhost:3001',
    'TanStack Query for data fetching & caching',
    'Tailwind CSS utility-first styling',
    'shadcn-vue + reka-ui components',
    'Vue Router with organized page structure',
    'TypeScript across frontend, backend & main process',
    'Atomic design component organization',
  ],
});
</script>

<template>
  <div class="mx-auto w-full p-8 md:p-4">
    <div class="flex flex-col gap-8">
      <h1 class="mb-4 text-center text-4xl font-bold text-slate-800 drop-shadow-md md:text-3xl">
        About {{ appInfo.name }}
      </h1>

      <Card class="bg-white/95 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Application Information</CardTitle>
          <CardDescription>{{ appInfo.description }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4">
            <div
              class="flex items-center justify-between border-b border-slate-200 py-2 last:border-b-0"
            >
              <strong>Version:</strong>
              <span>{{ appInfo.version }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card class="bg-white/95 backdrop-blur-md">
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>What makes this application special</CardDescription>
        </CardHeader>
        <CardContent>
          <ul class="grid list-none gap-4">
            <li
              v-for="feature in appInfo.features"
              :key="feature"
              class="border-primary-500 rounded-lg border-l-4 bg-slate-50 p-3 font-medium"
            >
              {{ feature }}
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
