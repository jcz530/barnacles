<script setup lang="ts">
import { Terminal as TerminalIcon } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { TerminalInstance } from '../../shared/types/api';
import TerminalCard from '../components/molecules/TerminalCard.vue';
import Terminal from '../components/organisms/Terminal.vue';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useBreadcrumbs } from '../composables/useBreadcrumbs';
import { useQueries } from '../composables/useQueries';

const router = useRouter();
const { setBreadcrumbs } = useBreadcrumbs();
const { useTerminalInstancesQuery, useKillTerminalMutation, useProjectsQuery } = useQueries();

const { data: terminals, isLoading } = useTerminalInstancesQuery();
const { data: projects } = useProjectsQuery();
const killTerminalMutation = useKillTerminalMutation();

const selectedTerminal = ref<string | null>(null);

// Helper to get project name by ID
const getProjectName = (projectId?: string) => {
  if (!projectId) return null;
  const project = projects.value?.find(p => p.id === projectId);
  return project?.name;
};

const navigateToProject = (projectId: string) => {
  router.push(`/projects/${projectId}`);
};

const activeTerminals = computed(() => {
  return terminals.value?.filter(t => t.status === 'running') || [];
});

const exitedTerminals = computed(() => {
  return terminals.value?.filter(t => t.status === 'exited') || [];
});

onMounted(() => {
  setBreadcrumbs([{ label: 'Processes' }]);

  // Auto-select the first terminal if available
  if (activeTerminals.value.length > 0 && !selectedTerminal.value) {
    selectedTerminal.value = activeTerminals.value[0].id;
  }
});

const handleKillTerminal = async (terminalId: string) => {
  try {
    await killTerminalMutation.mutateAsync(terminalId);

    // If we killed the selected terminal, select another one
    if (selectedTerminal.value === terminalId) {
      const remaining = activeTerminals.value.filter(t => t.id !== terminalId);
      selectedTerminal.value = remaining.length > 0 ? remaining[0].id : null;
    }
  } catch (error) {
    console.error('Failed to kill terminal:', error);
  }
};

const selectTerminal = (terminal: TerminalInstance) => {
  selectedTerminal.value = terminal.id;
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Processes</h1>
          <p class="mt-1 text-slate-600">View all running processes</p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar with terminal list -->
      <div class="w-80 overflow-y-auto border-r bg-slate-50 p-4">
        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 3" :key="i" class="h-20 w-full" />
        </div>

        <div
          v-else-if="activeTerminals.length === 0 && exitedTerminals.length === 0"
          class="py-8 text-center"
        >
          <TerminalIcon class="mx-auto h-12 w-12 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No active processes</p>
          <p class="mt-1 text-xs text-slate-500">Go to a project and run a script</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Active Terminals -->
          <div v-if="activeTerminals.length > 0">
            <h3 class="mb-2 text-sm font-semibold text-slate-700">
              Running ({{ activeTerminals.length }})
            </h3>
            <div class="space-y-2">
              <TerminalCard
                v-for="terminal in activeTerminals"
                :key="terminal.id"
                :terminal="terminal"
                :is-selected="selectedTerminal === terminal.id"
                :project-name="getProjectName(terminal.projectId)"
                :show-cwd="true"
                :on-kill="handleKillTerminal"
                :on-project-click="navigateToProject"
                :is-killing="!!killTerminalMutation.isPending"
                @select="selectTerminal"
              />
            </div>
          </div>

          <!-- Exited Terminals -->
          <div v-if="exitedTerminals.length > 0">
            <h3 class="mb-2 text-sm font-semibold text-slate-700">
              Exited ({{ exitedTerminals.length }})
            </h3>
            <div class="space-y-2">
              <TerminalCard
                v-for="terminal in exitedTerminals"
                :key="terminal.id"
                :terminal="terminal"
                :is-selected="selectedTerminal === terminal.id"
                :project-name="getProjectName(terminal.projectId)"
                :show-cwd="true"
                :on-kill="handleKillTerminal"
                :on-project-click="navigateToProject"
                @select="selectTerminal"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Terminal display area -->
      <div class="flex-1 bg-[#1e1e1e] p-4">
        <div v-if="selectedTerminal" class="h-full">
          <Terminal :terminal-id="selectedTerminal" />
        </div>
        <div v-else class="flex h-full items-center justify-center text-slate-400">
          <div class="text-center">
            <TerminalIcon class="mx-auto mb-4 h-16 w-16" />
            <p>Select a process to view output</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
