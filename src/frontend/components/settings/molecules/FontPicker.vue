<script setup lang="ts">
import { computed } from 'vue';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-vue-next';
import FontAutocomplete from './FontAutocomplete.vue';
import { useQueries } from '@/composables/useQueries';

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// Fetch system fonts from API
const { useSystemFontsQuery } = useQueries();
const { data: availableFonts, isLoading } = useSystemFontsQuery();

const localValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});

function clearFont() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <Label v-if="label">{{ label }}</Label>
      <Button
        v-if="modelValue"
        variant="ghost"
        size="sm"
        class="h-auto p-1 text-xs"
        @click="clearFont"
      >
        <X class="mr-1 h-3 w-3" />
        Clear
      </Button>
    </div>

    <div v-if="isLoading" class="bg-muted/50 rounded-lg border p-3">
      <p class="text-muted-foreground text-sm">Detecting available fonts...</p>
    </div>

    <div v-else>
      <FontAutocomplete
        v-model="localValue"
        :suggestions="availableFonts || []"
        :placeholder="placeholder || 'Search fonts...'"
        empty-message="No fonts found"
      />
    </div>

    <!-- Selected Font Preview -->
    <div v-if="modelValue" class="bg-muted/50 rounded-lg border p-3">
      <p class="text-muted-foreground mb-1 text-xs">Preview</p>
      <p class="font-medium" :style="{ fontFamily: modelValue }">
        {{ modelValue }}
      </p>
      <p class="text-muted-foreground mt-1 text-xs" :style="{ fontFamily: modelValue }">
        Like barnacles on a ship, these projects accumulate quickly 0123456789
      </p>
    </div>

    <p class="text-muted-foreground text-xs">
      {{ (availableFonts || []).length }} system fonts available
    </p>
  </div>
</template>
