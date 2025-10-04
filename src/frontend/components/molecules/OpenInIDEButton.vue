<script setup lang="ts">
import { ChevronDown, ExternalLink } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { DetectedIDE } from '../../../shared/types/api';
import { useQueries } from '../../composables/useQueries';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface Props {
  projectId: string;
  detectedIDEs?: DetectedIDE[];
  preferredIdeId?: string | null;
  isLoading?: boolean;
}

const props = defineProps<Props>();

const { useUpdatePreferredIDEMutation, useOpenProjectMutation } = useQueries();
const updateIDEMutation = useUpdatePreferredIDEMutation();
const openProjectMutation = useOpenProjectMutation();

const dropdownOpen = ref(false);

const installedIDEs = computed(() => {
  return props.detectedIDEs?.filter(ide => ide.installed) || [];
});

const preferredIDE = computed(() => {
  if (!props.preferredIdeId) return null;
  return installedIDEs.value.find(ide => ide.id === props.preferredIdeId);
});

const handleOpenInIDE = async () => {
  try {
    await openProjectMutation.mutateAsync({ projectId: props.projectId });
  } catch (error) {
    console.error('Failed to open project:', error);
    alert('Failed to open project. Make sure the IDE is installed.');
  }
};

const handleSelectIDE = async (ideId: string) => {
  try {
    await updateIDEMutation.mutateAsync({ projectId: props.projectId, ideId });
  } catch (error) {
    console.error('Failed to update preferred IDE:', error);
    alert('Failed to update preferred IDE. Please try again.');
  }
};

const handleMainButtonClick = () => {
  if (preferredIDE.value) {
    handleOpenInIDE();
  } else {
    dropdownOpen.value = true;
  }
};
</script>

<template>
  <div v-if="installedIDEs.length > 0" class="inline-flex">
    <!-- Main button - Opens IDE if preferred IDE is set, otherwise opens dropdown -->
    <Button
      variant="default"
      size="sm"
      :disabled="isLoading || openProjectMutation.isPending.value"
      @click="handleMainButtonClick"
      class="border-r-primary-foreground/20 rounded-r-none border-r"
    >
      <ExternalLink class="mr-2 h-4 w-4" />
      {{ preferredIDE ? `Open in ${preferredIDE.name}` : 'Select IDE' }}
    </Button>

    <!-- Dropdown trigger button -->
    <DropdownMenu v-model:open="dropdownOpen">
      <DropdownMenuTrigger as-child>
        <Button variant="default" size="sm" :disabled="isLoading" class="rounded-l-none px-2">
          <ChevronDown class="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Select IDE</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          v-for="ide in installedIDEs"
          :key="ide.id"
          @click="handleSelectIDE(ide.id)"
          :disabled="updateIDEMutation.isPending.value"
        >
          <div
            v-if="ide.color"
            class="mr-2 h-3 w-3 rounded-sm"
            :style="{ backgroundColor: ide.color }"
          />
          {{ ide.name }}
          <span v-if="ide.id === preferredIdeId" class="ml-auto text-xs text-slate-500">✓</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
