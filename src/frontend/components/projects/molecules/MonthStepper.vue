<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '../../ui/button';

const props = defineProps<{
  /** Selected month, YYYY-MM. */
  modelValue: string;
  /** Latest selectable month, YYYY-MM. Defaults to the current month. */
  maxMonth?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [month: string] }>();

const currentMonth = dayjs().format('YYYY-MM');
const ceiling = computed(() => props.maxMonth ?? currentMonth);

const label = computed(() => dayjs(`${props.modelValue}-01`).format('MMMM YYYY'));

// Future months are always empty, so there is nothing to navigate to.
const canGoForward = computed(() => props.modelValue < ceiling.value);
const isCurrentMonth = computed(() => props.modelValue === currentMonth);

const step = (months: number) => {
  const next = dayjs(`${props.modelValue}-01`).add(months, 'month').format('YYYY-MM');
  if (next > ceiling.value) return;
  emit('update:modelValue', next);
};
</script>

<template>
  <div class="flex items-center gap-1">
    <Button variant="ghost" size="icon" aria-label="Previous month" @click="step(-1)">
      <ChevronLeft class="size-4" />
    </Button>

    <span class="min-w-[9rem] text-center text-sm font-medium">{{ label }}</span>

    <Button
      variant="ghost"
      size="icon"
      aria-label="Next month"
      :disabled="!canGoForward"
      :title="canGoForward ? undefined : 'No future data'"
      @click="step(1)"
    >
      <ChevronRight class="size-4" />
    </Button>

    <Button
      v-if="!isCurrentMonth"
      variant="ghost"
      size="sm"
      class="ml-1"
      @click="emit('update:modelValue', currentMonth)"
    >
      This month
    </Button>
  </div>
</template>
