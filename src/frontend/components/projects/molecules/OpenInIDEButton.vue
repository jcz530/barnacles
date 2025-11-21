<script setup lang="ts">
import { ChevronDown, ExternalLink, Play, Star } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { DetectedIDE } from '../../../../shared/types/api';
import { useQueries } from '../../../composables/useQueries';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { toastDanger } from '../../ui/sonner';
import { handlePermissionError } from '../../../utils/error-handlers';

interface Props {
  projectId: string;
  detectedIDEs?: DetectedIDE[];
  preferredIdeId?: string | null;
  isLoading?: boolean;
}

const props = defineProps<Props>();

const { useUpdatePreferredIDEMutation, useOpenProjectMutation, useSettingsQuery } = useQueries();
const updateIDEMutation = useUpdatePreferredIDEMutation();
const openProjectMutation = useOpenProjectMutation();
const settingsQuery = useSettingsQuery({ enabled: true });

const dropdownOpen = ref(false);

const installedIDEs = computed(() => {
  return props.detectedIDEs?.filter(ide => ide.installed) || [];
});

const defaultIdeId = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === 'defaultIde');
  return setting?.value || null;
});

const preferredIDE = computed(() => {
  // Use project-specific preference first, then fall back to default setting
  const ideId = props.preferredIdeId || defaultIdeId.value;
  if (!ideId) return null;
  return installedIDEs.value.find(ide => ide.id === ideId);
});

const handleOpenInIDE = async (ideId?: string) => {
  try {
    await openProjectMutation.mutateAsync({ projectId: props.projectId, ideId });
  } catch (error: any) {
    console.error('Failed to open project:', error);

    const permissionMessage = handlePermissionError(error, 'IDE');
    if (permissionMessage) {
      alert(permissionMessage);
    } else {
      toastDanger('Failed to open project', {
        description: 'Make sure the IDE is installed and try again.',
      });
    }
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

        <div class="flex" v-for="ide in installedIDEs" :key="ide.id">
          <Button class="flex-1" as-child variant="ghost" title="Set as preferred terminal">
            <DropdownMenuItem
              @click="handleSelectIDE(ide.id)"
              :disabled="updateIDEMutation.isPending.value"
              class="flex items-center gap-2 pr-1"
            >
              <Star
                class="h-3 w-3 shrink-0"
                :class="
                  ide.id === preferredIdeId
                    ? 'fill-secondary-400 text-secondary-400'
                    : 'text-muted-foreground'
                "
              />
              <div
                v-if="ide.color"
                class="h-3 w-3 shrink-0 rounded-sm"
                :style="{ backgroundColor: ide.color }"
              />
              <span class="flex-1">{{ ide.name }}</span>
            </DropdownMenuItem>
          </Button>
          <Button
            variant="ghost"
            @click.stop="handleOpenInIDE(ide.id)"
            :disabled="openProjectMutation.isPending.value"
            class="hover:bg-muted ml-2 rounded p-1"
            title="Open once"
          >
            <Play class="h-3 w-3" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
