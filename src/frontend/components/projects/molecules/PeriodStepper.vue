<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '../../ui/button';
import { addIsoWeeks, currentIsoWeek, formatIsoWeekLabel } from '@shared/utils/iso-week';

export type PeriodGranularity = 'week' | 'month' | 'year';

const props = defineProps<{
  /** `YYYY-Www` for week, `YYYY-MM` for month, `YYYY` for year. */
  modelValue: string;
  granularity: PeriodGranularity;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

/** The latest selectable period — there is never data past the present one. */
const current = computed(() => {
  switch (props.granularity) {
    case 'week':
      return currentIsoWeek();
    case 'year':
      return dayjs().format('YYYY');
    default:
      return dayjs().format('YYYY-MM');
  }
});

const label = computed(() => {
  switch (props.granularity) {
    case 'week':
      return formatIsoWeekLabel(props.modelValue);
    case 'year':
      return props.modelValue;
    default:
      return dayjs(`${props.modelValue}-01`).format('MMMM YYYY');
  }
});

const isCurrent = computed(() => props.modelValue === current.value);

// All three formats sort lexicographically within a granularity, so a string
// compare is enough to know whether we are already at the present period.
const canGoForward = computed(() => props.modelValue < current.value);

const resetLabel = computed(() => {
  switch (props.granularity) {
    case 'week':
      return 'This week';
    case 'year':
      return 'This year';
    default:
      return 'This month';
  }
});

const step = (amount: number) => {
  let next: string;
  switch (props.granularity) {
    case 'week':
      next = addIsoWeeks(props.modelValue, amount);
      break;
    case 'year':
      next = String(Number(props.modelValue) + amount);
      break;
    default:
      next = dayjs(`${props.modelValue}-01`).add(amount, 'month').format('YYYY-MM');
  }

  if (next > current.value) return;
  emit('update:modelValue', next);
};
</script>

<template>
  <div class="flex items-center gap-1">
    <Button variant="ghost" size="icon" :aria-label="`Previous ${granularity}`" @click="step(-1)">
      <ChevronLeft class="size-4" />
    </Button>

    <!-- Wide enough for the longest week label, so the arrows don't shift as
         the text changes. -->
    <span class="min-w-[11rem] text-center text-sm font-medium">{{ label }}</span>

    <Button
      variant="ghost"
      size="icon"
      :aria-label="`Next ${granularity}`"
      :disabled="!canGoForward"
      :title="canGoForward ? undefined : 'No future data'"
      @click="step(1)"
    >
      <ChevronRight class="size-4" />
    </Button>

    <Button
      v-if="!isCurrent"
      variant="ghost"
      size="sm"
      class="ml-1"
      @click="emit('update:modelValue', current)"
    >
      {{ resetLabel }}
    </Button>
  </div>
</template>
