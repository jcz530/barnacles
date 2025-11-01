<script setup lang="ts">
import { LayoutGrid, Table } from 'lucide-vue-next';

defineProps<{
  currentView: 'table' | 'card';
}>();

defineEmits<{
  'update:view': [view: 'table' | 'card'];
}>();

const buttonClasses = 'cursor-pointer px-4 py-2 text-sm font-medium hover:bg-slate-200';
const activeClasses = 'text-primary-700 bg-slate-200';
</script>

<template>
  <div class="inline-flex rounded-md shadow-xs" role="group">
    <button
      type="button"
      :class="['rounded-l-lg', buttonClasses, currentView === 'table' && activeClasses]"
      @click="$emit('update:view', 'table')"
    >
      <Table :size="16" />
    </button>
    <button
      type="button"
      :class="['rounded-r-lg', buttonClasses, currentView === 'card' && activeClasses]"
      @click="$emit('update:view', 'card')"
    >
      <LayoutGrid :size="16" />
    </button>
  </div>
</template>
