<script setup lang="ts">
import { computed, ref } from 'vue';
import Terminal from './Terminal.vue';
import TerminalCard from '../molecules/TerminalCard.vue';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { useQueries } from '../../composables/useQueries';
import { Plus, Terminal as TerminalIcon, Play } from 'lucide-vue-next';
import type { TerminalInstance } from '../../../shared/types/api';

const props = defineProps<{
  projectId: string;
  projectPath: string;
  packageJsonScripts?: Record<string, string>;
}>();

const { useTerminalInstancesQuery, useCreateTerminalMutation, useKillTerminalMutation } =
  useQueries();

const { data: terminals, isLoading } = useTerminalInstancesQuery(computed(() => props.projectId));
const createTerminalMutation = useCreateTerminalMutation();
const killTerminalMutation = useKillTerminalMutation();

const selectedTerminal = ref<string | null>(null);

const projectTerminals = computed(() => {
  return terminals.value?.filter(t => t.projectId === props.projectId) || [];
});

const activeTerminals = computed(() => {
  return projectTerminals.value.filter(t => t.status === 'running');
});

// Auto-select first terminal when available
const autoSelectTerminal = () => {
  if (activeTerminals.value.length > 0 && !selectedTerminal.value) {
    selectedTerminal.value = activeTerminals.value[0].id;
  }
};

const handleCreateTerminal = async (command?: string, title?: string) => {
  try {
    const newTerminal = await createTerminalMutation.mutateAsync({
      projectId: props.projectId,
      command,
      title: title || 'New Terminal',
    });

    if (newTerminal) {
      selectedTerminal.value = newTerminal.id;
    }
  } catch (error) {
    console.error('Failed to create terminal:', error);
  }
};

const handleKillTerminal = async (terminalId: string) => {
  try {
    await killTerminalMutation.mutateAsync(terminalId);

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

const runScript = (scriptName: string) => {
  handleCreateTerminal(`npm run ${scriptName}`, `npm run ${scriptName}`);
};

// Auto-select on load
autoSelectTerminal();
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Package.json Scripts Section -->
    <Card v-if="packageJsonScripts && Object.keys(packageJsonScripts).length > 0">
      <CardHeader>
        <CardTitle>Package Scripts</CardTitle>
        <CardDescription>Run scripts from package.json</CardDescription>
      </CardHeader>
      <div class="p-6 pt-0">
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            v-for="(command, name) in packageJsonScripts"
            :key="name"
            variant="outline"
            class="justify-start"
            @click="() => runScript(name as string)"
          >
            <Play class="mr-2 h-4 w-4" />
            <div class="text-left">
              <div class="font-semibold">{{ name }}</div>
              <div class="truncate text-xs text-slate-500">{{ command }}</div>
            </div>
          </Button>
        </div>
      </div>
    </Card>

    <!-- Terminals Section -->
    <div class="flex h-[600px] overflow-hidden rounded-lg border bg-white">
      <!-- Sidebar with terminal list -->
      <div class="w-72 overflow-y-auto border-r bg-slate-50 p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-semibold text-slate-800">Terminals</h3>
          <Button
            size="sm"
            variant="outline"
            @click="() => handleCreateTerminal()"
            :disabled="createTerminalMutation.isPending"
          >
            <Plus class="h-4 w-4" />
          </Button>
        </div>

        <div v-if="isLoading" class="space-y-2">
          <Skeleton v-for="i in 2" :key="i" class="h-20 w-full" />
        </div>

        <div v-else-if="activeTerminals.length === 0" class="py-8 text-center">
          <TerminalIcon class="mx-auto h-10 w-10 text-slate-400" />
          <p class="mt-2 text-sm text-slate-600">No active terminals</p>
          <Button @click="() => handleCreateTerminal()" variant="outline" size="sm" class="mt-4">
            <Plus class="mr-2 h-4 w-4" />
            Create Terminal
          </Button>
        </div>

        <div v-else class="space-y-2">
          <TerminalCard
            v-for="terminal in activeTerminals"
            :key="terminal.id"
            :terminal="terminal"
            :is-selected="selectedTerminal === terminal.id"
            :show-cwd="false"
            :on-kill="handleKillTerminal"
            :is-killing="!!killTerminalMutation.isPending"
            @select="selectTerminal"
          />
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
            <p>Select a terminal or create a new one</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
