<script setup lang="ts">
import type { User } from '../../../shared/types/api';

defineProps<{
  user: User;
}>();
</script>

<template>
  <div
    class="rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm transition-shadow hover:shadow-md"
  >
    <div class="mb-2">
      <span class="text-xs text-slate-500">ID: {{ user.id }}</span>
    </div>
    <h3 class="mb-1 text-lg font-semibold">{{ user.name }}</h3>
    <p class="text-sm text-slate-600">{{ user.email }}</p>
  </div>
</template>
