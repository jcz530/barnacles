<script setup lang="ts">
import { Plus, Trash2, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { StartProcess } from '../../../../shared/types/process';
import { useQueries } from '../../../composables/useQueries';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../ui/sheet';
import AutocompleteInput from '../../molecules/AutocompleteInput.vue';

interface Props {
  projectId: string;
  isOpen: boolean;
  initialProcesses?: StartProcess[];
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void;
  (e: 'save', processes: StartProcess[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const processes = ref<StartProcess[]>([]);

// Fetch package scripts, hosts, and project details for autocomplete
const { useProjectPackageScriptsQuery, useProjectQuery, useHostsQuery } = useQueries();
const { data: packageScripts } = useProjectPackageScriptsQuery(props.projectId, {
  enabled: true,
});
const { data: project } = useProjectQuery(props.projectId);
const { data: hosts } = useHostsQuery({ enabled: true });

// Detect package manager from project files
const detectedPackageManager = ref<'npm' | 'yarn' | 'pnpm'>('npm');

watch(
  () => project.value,
  async newProject => {
    if (!newProject) return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const projectPath = newProject.path;

      // Check for lock files to determine package manager
      const hasPnpmLock = await fs
        .access(path.join(projectPath, 'pnpm-lock.yaml'))
        .then(() => true)
        .catch(() => false);
      if (hasPnpmLock) {
        detectedPackageManager.value = 'pnpm';
        return;
      }

      const hasYarnLock = await fs
        .access(path.join(projectPath, 'yarn.lock'))
        .then(() => true)
        .catch(() => false);
      if (hasYarnLock) {
        detectedPackageManager.value = 'yarn';
        return;
      }

      detectedPackageManager.value = 'npm';
    } catch {
      detectedPackageManager.value = 'npm';
    }
  },
  { immediate: true }
);

// Generate command suggestions from detected package scripts only
const commandSuggestions = computed(() => {
  const suggestions: string[] = [];

  if (packageScripts.value) {
    Object.keys(packageScripts.value).forEach(scriptName => {
      switch (detectedPackageManager.value) {
        case 'yarn':
          suggestions.push(`yarn ${scriptName}`);
          break;
        case 'pnpm':
          suggestions.push(`pnpm ${scriptName}`);
          break;
        default:
          suggestions.push(`npm run ${scriptName}`);
      }
    });
  }

  return suggestions;
});

// Generate URL suggestions from hosts file
const urlSuggestions = computed(() => {
  const suggestions: Set<string> = new Set();

  if (hosts.value) {
    hosts.value.forEach(host => {
      suggestions.add(`http://${host.hostname}`);
    });
  }

  return [...suggestions].filter(
    (url: string) => !url.includes('localhost') && !url.includes('127.0.0.1')
  );
});

// Initialize processes when the sheet opens
watch(
  () => props.isOpen,
  (isOpen: boolean) => {
    if (isOpen) {
      processes.value = props.initialProcesses
        ? JSON.parse(JSON.stringify(props.initialProcesses))
        : [];
    }
  }
);

const addProcess = () => {
  processes.value.push({
    id: `process-${Date.now()}`,
    name: '',
    commands: [''],
    color: '#3b82f6',
  });
};

const removeProcess = (index: number) => {
  processes.value.splice(index, 1);
};

const addCommand = (processIndex: number) => {
  processes.value[processIndex].commands.push('');
};

const removeCommand = (processIndex: number, commandIndex: number) => {
  processes.value[processIndex].commands.splice(commandIndex, 1);
};

const handleSave = () => {
  // Filter out empty processes and commands
  const validProcesses = processes.value
    .filter(p => p.name && p.commands.some(c => c.trim()))
    .map(p => ({
      ...p,
      commands: p.commands.filter(c => c.trim()),
    }));

  emit('save', validProcesses);
  emit('update:isOpen', false);
};

const handleClose = () => {
  emit('update:isOpen', false);
};
</script>

<template>
  <Sheet :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <SheetContent class="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>Configure Start Command</SheetTitle>
        <SheetDescription>
          Define processes that will run when you start this project. Each process can have multiple
          commands that run sequentially.
        </SheetDescription>
      </SheetHeader>

      <div class="space-y-6 py-6">
        <!-- Process List -->
        <div v-if="processes.length === 0" class="py-8 text-center text-slate-500">
          <p>No processes configured yet.</p>
          <p class="text-sm">Click "Add Process" to get started.</p>
        </div>

        <div v-for="(process, processIndex) in processes" :key="process.id" class="space-y-4">
          <div class="space-y-4 rounded-lg border p-4">
            <!-- Process Header -->
            <div class="flex items-center gap-2">
              <div class="flex-1 space-y-2">
                <label class="text-sm font-medium">Process Name</label>
                <Input
                  v-model="process.name"
                  placeholder="e.g., Frontend Server, Backend API"
                  class="w-full"
                />
              </div>
              <div class="pt-7">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="removeProcess(processIndex)"
                  class="text-red-500 hover:text-red-600"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <!-- Working Directory (Optional) -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Working Directory (optional)</label>
              <Input
                v-model="process.workingDir"
                placeholder="e.g., frontend, backend (relative to project root)"
                class="w-full"
              />
            </div>

            <!-- URL (Optional) -->
            <div class="space-y-2">
              <label class="text-sm font-medium">URL (optional)</label>
              <AutocompleteInput
                class="w-full"
                v-model="process.url"
                :suggestions="urlSuggestions"
                placeholder="e.g., http://localhost:3000"
              />
              <p class="text-xs text-slate-500">
                The URL where this process will be accessible. If not provided, we'll try to detect
                it from the output.
              </p>
            </div>

            <!-- Commands -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Commands</label>
              <div
                v-for="(command, commandIndex) in process.commands"
                :key="commandIndex"
                class="flex items-center gap-2"
              >
                <div class="relative flex-1">
                  <AutocompleteInput
                    v-model="process.commands[commandIndex]"
                    :suggestions="commandSuggestions"
                    placeholder="e.g., npm install, npm run dev"
                  />
                </div>
                <Button
                  v-if="process.commands.length > 1"
                  variant="ghost"
                  size="sm"
                  @click="removeCommand(processIndex, commandIndex)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                @click="addCommand(processIndex)"
                class="mt-2 w-full"
              >
                <Plus class="mr-2 h-4 w-4" />
                Add Command
              </Button>
            </div>

            <!-- Color Picker -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Color</label>
              <div class="flex items-center gap-2">
                <input
                  type="color"
                  v-model="process.color"
                  class="h-10 w-20 cursor-pointer rounded border"
                />
                <span class="text-sm text-slate-500">{{ process.color }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Process Button -->
        <Button variant="outline" @click="addProcess" class="w-full">
          <Plus class="mr-2 h-4 w-4" />
          Add Process
        </Button>
      </div>

      <SheetFooter>
        <SheetClose as-child>
          <Button variant="outline" @click="handleClose">Cancel</Button>
        </SheetClose>
        <Button @click="handleSave">Save Configuration</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
