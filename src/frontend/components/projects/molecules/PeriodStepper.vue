<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { Button } from '../../ui/button';
import { addIsoWeeks, currentIsoWeek, formatIsoWeekLabel } from '../../../utils/iso-week';

export type PeriodGranularity = 'week' | 'month';

const props = defineProps<{
  /** `YYYY-Www` when granularity is week, `YYYY-MM` when month. */
  modelValue: string;
  granularity: PeriodGranularity;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const isWeek = computed(() => props.granularity === 'week');

/** The latest selectable period — there is never data past the present one. */
const current = computed(() => (isWeek.value ? currentIsoWeek() : dayjs().format('YYYY-MM')));

const label = computed(() =>
  isWeek.value
    ? formatIsoWeekLabel(props.modelValue)
    : dayjs(`${props.modelValue}-01`).format('MMMM YYYY')
);

const isCurrent = computed(() => props.modelValue === current.value);

// Both formats sort lexicographically within a granularity, so a string compare
// is enough to know whether we are already at the present period.
const canGoForward = computed(() => props.modelValue < current.value);

const resetLabel = computed(() => (isWeek.value ? 'This week' : 'This month'));

const step = (amount: number) => {
  const next = isWeek.value
    ? addIsoWeeks(props.modelValue, amount)
    : dayjs(`${props.modelValue}-01`).add(amount, 'month').format('YYYY-MM');

  if (next > current.value) return;
  emit('update:modelValue', next);
};
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon"
      :aria-label="isWeek ? 'Previous week' : 'Previous month'"
      @click="step(-1)"
    >
      <ChevronLeft class="size-4" />
    </Button>

    <!-- Wide enough for the longest week label, so the arrows don't shift as
         the text changes. -->
    <span class="min-w-[11rem] text-center text-sm font-medium">{{ label }}</span>

    <Button
      variant="ghost"
      size="icon"
      :aria-label="isWeek ? 'Next week' : 'Next month'"
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
