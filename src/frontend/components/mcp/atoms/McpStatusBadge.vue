<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next';
import type { EventStatus } from '../../../../shared/types/api';

defineProps<{
  status: EventStatus;
}>();
</script>

<template>
  <span
    v-if="status === 'success'"
    class="text-success-500 inline-flex items-center gap-1 text-xs font-medium"
  >
    <CheckCircle2 class="h-3.5 w-3.5" />
    Success
  </span>
  <span v-else class="text-danger-500 inline-flex items-center gap-1 text-xs font-medium">
    <XCircle class="h-3.5 w-3.5" />
    Error
  </span>
</template>
