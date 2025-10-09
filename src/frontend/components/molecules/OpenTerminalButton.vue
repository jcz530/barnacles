<script setup lang="ts">
import { ChevronDown, Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { DetectedTerminal } from '../../../shared/types/api';
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

const handleOpenTerminal = async () => {
  try {
    await openTerminalMutation.mutateAsync({ projectId: props.projectId });
  } catch (error) {
    console.error('Failed to open terminal:', error);
    alert('Failed to open terminal. Make sure the terminal is installed.');
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
        <DropdownMenuItem
          v-for="terminal in installedTerminals"
          :key="terminal.id"
          @click="handleSelectTerminal(terminal.id)"
          :disabled="updateTerminalMutation.isPending.value"
        >
          <div
            v-if="terminal.color"
            class="mr-2 h-3 w-3 rounded-sm"
            :style="{ backgroundColor: terminal.color }"
          />
          {{ terminal.name }}
          <span v-if="terminal.id === preferredTerminalId" class="ml-auto text-xs text-slate-500"
            >✓</span
          >
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
