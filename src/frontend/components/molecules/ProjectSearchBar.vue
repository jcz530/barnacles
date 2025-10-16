<script setup lang="ts">
import { ref } from 'vue';
import { Search, X } from 'lucide-vue-next';
import { Input } from '../ui/input';

const modelValue = defineModel<string>({ required: true });
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
      placeholder="Search projects..."
      class="pr-10 pl-10"
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
