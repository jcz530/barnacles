<script setup lang="ts">
import { ChevronDown, Play, Star, Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { DetectedTerminal } from '../../../../shared/types/api';
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
  detectedTerminals?: DetectedTerminal[];
  preferredTerminalId?: string | null;
  isLoading?: boolean;
}

const props = defineProps<Props>();

const { useUpdatePreferredTerminalMutation, useOpenTerminalMutation, useSettingsQuery } =
  useQueries();
const updateTerminalMutation = useUpdatePreferredTerminalMutation();
const openTerminalMutation = useOpenTerminalMutation();
const settingsQuery = useSettingsQuery({ enabled: true });

const dropdownOpen = ref(false);

const installedTerminals = computed(() => {
  return props.detectedTerminals?.filter(terminal => terminal.installed) || [];
});

const defaultTerminalId = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === 'defaultTerminal');
  return setting?.value || null;
});

const preferredTerminal = computed(() => {
  // Use project-specific preference first, then fall back to default setting
  const terminalId = props.preferredTerminalId || defaultTerminalId.value;
  if (!terminalId) return null;
  return installedTerminals.value.find(terminal => terminal.id === terminalId);
});

const handleOpenTerminal = async (terminalId?: string) => {
  try {
    await openTerminalMutation.mutateAsync({ projectId: props.projectId, terminalId });
  } catch (error: any) {
    console.error('Failed to open terminal:', error);

    const permissionMessage = handlePermissionError(error, 'terminal');
    if (permissionMessage) {
      alert(permissionMessage);
    } else {
      toastDanger('Failed to open terminal', {
        description: 'Make sure the terminal is installed and try again.',
      });
    }
  }
};

const handleSelectTerminal = async (terminalId: string) => {
  try {
    await updateTerminalMutation.mutateAsync({ projectId: props.projectId, terminalId });
  } catch (error) {
    console.error('Failed to update preferred terminal:', error);
    alert('Failed to update preferred terminal. Please try again.');
  }
};

const handleMainButtonClick = () => {
  if (preferredTerminal.value) {
    handleOpenTerminal();
  } else {
    dropdownOpen.value = true;
  }
};
</script>

<template>
  <div v-if="installedTerminals.length > 0" class="inline-flex">
    <!-- Main button - Opens terminal if preferred terminal is set, otherwise opens dropdown -->
    <Button
      variant="outline"
      size="sm"
      :disabled="isLoading || openTerminalMutation.isPending.value"
      @click="handleMainButtonClick"
      class="border-r-muted-foreground/20 rounded-r-none border-r"
    >
      <TerminalIcon class="mr-2 h-4 w-4" />
      {{ preferredTerminal ? `Open ${preferredTerminal.name}` : 'Select Terminal' }}
    </Button>

    <!-- Dropdown trigger button -->
    <DropdownMenu v-model:open="dropdownOpen">
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" :disabled="isLoading" class="rounded-l-none px-2">
          <ChevronDown class="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Select Terminal</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div class="flex" v-for="terminal in installedTerminals" :key="terminal.id">
          <Button class="flex-1" as-child variant="ghost" title="Set as preferred terminal">
            <DropdownMenuItem
              @click="handleSelectTerminal(terminal.id)"
              :disabled="updateTerminalMutation.isPending.value"
              class="flex items-center gap-2 pr-1"
            >
              <Star
                class="h-3 w-3 shrink-0"
                :class="
                  terminal.id === preferredTerminalId
                    ? 'fill-secondary-400 text-secondary-400'
                    : 'text-muted-foreground'
                "
              />
              <div
                v-if="terminal.color"
                class="h-3 w-3 shrink-0 rounded-sm"
                :style="{ backgroundColor: terminal.color }"
              />
              <span class="flex-1">{{ terminal.name }}</span>
            </DropdownMenuItem>
          </Button>
          <Button
            variant="ghost"
            @click.stop="handleOpenTerminal(terminal.id)"
            :disabled="openTerminalMutation.isPending.value"
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
