<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { Input } from '../ui/input';

interface Props {
  modelValue: string;
  placeholder?: string;
  isInvalid?: boolean;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  isInvalid: false,
  class: '',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const isEditing = ref(false);
const inputRef = ref<InstanceType<typeof Input> | null>(null);

const isEmpty = computed(() => !props.modelValue || props.modelValue.trim() === '');

const startEditing = () => {
  isEditing.value = true;
  nextTick(() => {
    // Access the native input element from the Input component
    const el = inputRef.value?.$el as HTMLInputElement;
    if (el) {
      el.focus();
      // Move cursor to the end of the input
      el.setSelectionRange(el.value.length, el.value.length);
    }
  });
};

const stopEditing = () => {
  isEditing.value = false;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    stopEditing();
  } else if (event.key === 'Escape') {
    stopEditing();
  }
};
</script>

<template>
  <div class="inline-edit-wrapper">
    <!-- Display Mode -->
    <div
      v-if="!isEditing"
      class="inline-edit-display group hover:bg-muted/50 relative cursor-text rounded px-3 py-2 font-mono text-sm transition-colors"
      :class="[
        {
          'text-muted-foreground italic': isEmpty,
          'border border-red-500': isInvalid,
          'border border-transparent': !isInvalid,
        },
        props.class,
      ]"
      @click="startEditing"
      @keydown.enter="startEditing"
      tabindex="0"
    >
      <span v-if="isEmpty">{{ placeholder }}</span>
      <span v-else>{{ modelValue }}</span>
    </div>

    <!-- Edit Mode -->
    <Input
      v-else
      ref="inputRef"
      :model-value="modelValue"
      :placeholder="placeholder"
      class="font-mono text-sm"
      :class="{
        'border-red-500': isInvalid,
      }"
      @update:model-value="val => emit('update:modelValue', val)"
      @blur="stopEditing"
      @keydown="handleKeydown"
    />
  </div>
</template>

<style scoped>
.inline-edit-wrapper {
  width: 100%;
}

.inline-edit-display {
  min-height: 38px;
  display: flex;
  align-items: center;
}

.inline-edit-display:focus {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
</style>
