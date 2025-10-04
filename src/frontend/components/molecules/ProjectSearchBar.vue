<script setup lang="ts">
import { ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { Input } from '../ui/input';
import { Search, X } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const localValue = ref(props.modelValue);

const debouncedUpdate = useDebounceFn((value: string) => {
  emit('update:modelValue', value);
}, 300);

const updateValue = (event: Event) => {
  const target = event.target as HTMLInputElement;
  localValue.value = target.value;
  debouncedUpdate(target.value);
};

const clearSearch = () => {
  localValue.value = '';
  emit('update:modelValue', '');
};
</script>

<template>
  <div class="relative flex-1">
    <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
    <Input
      :value="localValue"
      @input="updateValue"
      placeholder="Search projects..."
      class="pr-10 pl-10"
    />
    <button
      v-if="localValue"
      @click="clearSearch"
      class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-700"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
