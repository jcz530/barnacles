<script setup lang="ts">
import { LayoutGrid, Table } from 'lucide-vue-next';

defineProps<{
  currentView: 'table' | 'card';
}>();

defineEmits<{
  'update:view': [view: 'table' | 'card'];
}>();
</script>

<template>
  <div class="inline-flex rounded-md shadow-sm" role="group">
    <button
      type="button"
      :class="[
        'rounded-l-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100',
        currentView === 'table' ? 'bg-slate-100' : 'bg-slate-50',
      ]"
      @click="$emit('update:view', 'table')"
    >
      <Table :size="16" />
    </button>
    <button
      type="button"
      :class="[
        'rounded-r-lg border-t border-r border-b border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-100',
        currentView === 'card' ? 'bg-slate-100' : 'bg-slate-50',
      ]"
      @click="$emit('update:view', 'card')"
    >
      <LayoutGrid :size="16" />
    </button>
  </div>
</template>
