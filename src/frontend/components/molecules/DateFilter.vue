<script setup lang="ts">
import { computed } from 'vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs/';
import { Calendar } from 'lucide-vue-next';

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year';
export type DateFilterDirection = 'within' | 'older';

const props = defineProps<{
  selectedPreset: DatePreset;
  direction: DateFilterDirection;
}>();

const emit = defineEmits<{
  'update:selectedPreset': [value: DatePreset];
  'update:direction': [value: DateFilterDirection];
}>();

interface PresetOption {
  value: DatePreset;
  label: string;
  withinDescription: string;
  olderDescription: string;
}

const presets: PresetOption[] = [
  {
    value: 'all',
    label: 'All Time',
    withinDescription: 'Show all projects',
    olderDescription: 'Show all projects',
  },
  {
    value: 'today',
    label: 'Today',
    withinDescription: 'Modified today',
    olderDescription: 'Modified before today',
  },
  {
    value: 'week',
    label: 'Week',
    withinDescription: 'Modified in the last 7 days',
    olderDescription: 'Modified over a week ago',
  },
  {
    value: 'month',
    label: 'Month',
    withinDescription: 'Modified in the last 30 days',
    olderDescription: 'Modified over a month ago',
  },
  {
    value: 'quarter',
    label: 'Quarter',
    withinDescription: 'Modified in the last 90 days',
    olderDescription: 'Modified over 3 months ago',
  },
  {
    value: 'year',
    label: 'Year',
    withinDescription: 'Modified in the last 365 days',
    olderDescription: 'Modified over a year ago',
  },
];

const selectPreset = (preset: DatePreset) => {
  emit('update:selectedPreset', preset);
};

const selectDirection = (direction: DateFilterDirection) => {
  emit('update:direction', direction);
};

const hasFilter = computed(() => props.selectedPreset !== 'all');

const selectedLabel = computed(() => {
  if (props.selectedPreset === 'all') {
    return 'All Time';
  }

  const preset = presets.find(p => p.value === props.selectedPreset);
  const label = preset?.label || '';
  const prefix = props.direction === 'within' ? 'Past' : 'Older than';

  if (props.selectedPreset === 'today' && props.direction === 'within') {
    return 'Today';
  }

  return `${prefix} ${label}`;
});
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" class="relative">
        <Calendar class="mr-2 h-4 w-4" />
        {{ selectedLabel }}
        <span v-if="hasFilter" class="ml-2 h-2 w-2 rounded-full bg-slate-800" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64">
      <DropdownMenuLabel>Filter by Last Modified</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <!-- Direction selector -->
      <div class="px-2 py-2">
        <Tabs :model-value="direction" @update:model-value="selectDirection">
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="within" class="text-xs">Modified within</TabsTrigger>
            <TabsTrigger value="older" class="text-xs">Older than</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DropdownMenuSeparator />

      <!-- Preset options -->
      <div class="py-1">
        <div
          v-for="preset in presets"
          :key="preset.value"
          class="relative flex cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-2 text-sm outline-none select-none hover:bg-slate-100"
          :class="{
            'bg-slate-100': selectedPreset === preset.value,
          }"
          @click="selectPreset(preset.value)"
        >
          <div class="flex items-center gap-2">
            <input
              type="radio"
              :checked="selectedPreset === preset.value"
              class="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
              @click.stop="selectPreset(preset.value)"
            />
            <span class="font-medium">{{ preset.label }}</span>
          </div>
          <span class="ml-6 text-xs text-slate-500">
            {{ direction === 'within' ? preset.withinDescription : preset.olderDescription }}
          </span>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
