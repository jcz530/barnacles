<script setup lang="ts">
import { ref, type HTMLAttributes } from 'vue';
import { Search, X } from 'lucide-vue-next';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

const modelValue = defineModel<string>({ required: true });

const { placeholder = 'Search projects...', inputClass = '' } = defineProps<{
  placeholder?: string;
  /** Extra classes for the field itself, for callers that restyle it. */
  inputClass?: HTMLAttributes['class'];
}>();
const inputRef = ref<any>(null);

const clearSearch = () => {
  modelValue.value = '';
};

const focus = () => {
  // The Input component wraps a native input element
  // We need to access it via $el or directly if it's the root element
  const element = inputRef.value?.$el || inputRef.value;
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
};

defineExpose({
  focus,
});
</script>
<template>
  <div class="relative flex-1">
    <Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
    <Input
      ref="inputRef"
      v-model="modelValue"
      :placeholder="placeholder"
      :class="cn('pr-10 pl-10', inputClass)"
    />
    <button
      v-if="modelValue"
      @click="clearSearch"
      class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-700"
    >
      <X class="h-4 w-4" />
    </button>
  </div>
</template>
