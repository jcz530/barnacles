<script setup lang="ts">
import { computed } from 'vue';
import { EyeOff, Eye, FolderX, Lock } from 'lucide-vue-next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Button } from '../../ui/button';

interface Exclusion {
  id: string;
  path: string;
}

const props = defineProps<{
  exclusions: Exclusion[];
  globalExclusions: string[];
}>();

const emit = defineEmits<{
  remove: [exclusionId: string];
}>();

const totalCount = computed(() => props.exclusions.length + props.globalExclusions.length);
const hasExclusions = computed(() => totalCount.value > 0);

const handleRemove = (exclusionId: string) => {
  emit('remove', exclusionId);
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="relative h-6 px-2"
        :class="{ 'text-slate-400': !hasExclusions, 'text-slate-600': hasExclusions }"
        title="Hidden directories"
      >
        <EyeOff :size="16" />
        <span
          v-if="hasExclusions"
          class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-500 px-1 text-[10px] text-white"
        >
          {{ totalCount }}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-72" align="end">
      <DropdownMenuLabel>Hidden Directories</DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div v-if="!hasExclusions" class="flex flex-col items-center gap-2 px-2 py-6 text-center">
        <FolderX class="h-8 w-8 text-slate-300" />
        <p class="text-sm text-slate-500">No directories hidden</p>
        <p class="text-xs text-slate-400">Right-click a folder to hide it</p>
      </div>

      <div v-else class="max-h-60 overflow-y-auto">
        <!-- Global exclusions (always hidden, non-removable) -->
        <template v-if="globalExclusions.length > 0">
          <div class="px-2 py-1">
            <span class="text-xs font-medium text-slate-400">Always Hidden</span>
          </div>
          <div
            v-for="path in globalExclusions"
            :key="`global-${path}`"
            class="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5"
          >
            <span class="flex-1 truncate font-mono text-sm text-slate-400" :title="path">
              {{ path }}
            </span>
            <Lock class="h-4 w-4 flex-shrink-0 text-slate-300" title="Global exclusion" />
          </div>
        </template>

        <!-- Custom exclusions (removable) -->
        <template v-if="exclusions.length > 0">
          <div v-if="globalExclusions.length > 0" class="my-1">
            <DropdownMenuSeparator />
          </div>
          <div class="px-2 py-1">
            <span class="text-xs font-medium text-slate-400">Custom Hidden</span>
          </div>
          <div
            v-for="exclusion in exclusions"
            :key="exclusion.id"
            class="group flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-slate-100"
          >
            <span class="flex-1 truncate font-mono text-sm text-slate-600" :title="exclusion.path">
              {{ exclusion.path }}
            </span>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-600"
              @click="handleRemove(exclusion.id)"
              title="Show in file tree"
            >
              <Eye class="h-4 w-4" />
            </Button>
          </div>
        </template>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
