<script setup lang="ts">
import { Plus, Trash2, Wrench, X, Zap } from 'lucide-vue-next';
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
import { Checkbox } from '../../ui/checkbox';
import { Label } from '../../ui/label';
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
const configMode = ref<'quick' | 'advanced'>('quick');
const selectedScripts = ref<string[]>([]); // Format: "type:scriptName" e.g., "npm:dev" or "composer:install"

// Fetch package scripts, composer scripts, hosts, package manager, and project details for autocomplete
const {
  useProjectPackageScriptsQuery,
  useProjectComposerScriptsQuery,
  useProjectPackageManagerQuery,
  useProjectQuery,
  useHostsQuery,
} = useQueries();
const { data: packageScripts } = useProjectPackageScriptsQuery(props.projectId, {
  enabled: true,
});
const { data: composerScripts } = useProjectComposerScriptsQuery(props.projectId, {
  enabled: true,
});
const { data: project } = useProjectQuery(props.projectId);
const { data: hosts } = useHostsQuery({ enabled: true });

// Detect package manager from backend API
const { data: detectedPackageManager } = useProjectPackageManagerQuery(props.projectId, {
  enabled: true,
});

// Generate command suggestions from detected package scripts and composer scripts
const commandSuggestions = computed(() => {
  const suggestions: string[] = [];
  const pkgManager = detectedPackageManager.value || 'npm';

  if (packageScripts.value) {
    Object.keys(packageScripts.value).forEach(scriptName => {
      switch (pkgManager) {
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

  if (composerScripts.value) {
    Object.keys(composerScripts.value).forEach(scriptName => {
      suggestions.push(`composer ${scriptName}`);
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

// Color palette for quick setup
const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Generate process config from script key (format: "type:scriptName")
const generateProcessFromScript = (scriptKey: string): StartProcess => {
  const [type, scriptName] = scriptKey.split(':');
  const colorIndex = selectedScripts.value.length % colorPalette.length;
  const pkgManager = detectedPackageManager.value || 'npm';

  let command: string;
  if (type === 'composer') {
    command = `composer ${scriptName}`;
  } else {
    // npm/yarn/pnpm
    command =
      pkgManager === 'yarn'
        ? `yarn ${scriptName}`
        : pkgManager === 'pnpm'
          ? `pnpm ${scriptName}`
          : `npm run ${scriptName}`;
  }

  return {
    id: `process-${Date.now()}-${scriptName}`,
    name: scriptName.charAt(0).toUpperCase() + scriptName.slice(1).replace(/-/g, ' '),
    commands: [command],
    color: colorPalette[colorIndex],
  };
};

// Initialize processes when the sheet opens
watch(
  () => props.isOpen,
  (isOpen: boolean) => {
    if (isOpen) {
      // Determine mode based on whether we have existing processes
      const hasExistingProcesses = props.initialProcesses && props.initialProcesses.length > 0;
      configMode.value = hasExistingProcesses ? 'advanced' : 'quick';

      processes.value = props.initialProcesses
        ? JSON.parse(JSON.stringify(props.initialProcesses))
        : [];

      // Reset selected scripts
      selectedScripts.value = [];
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

const toggleScriptSelection = (scriptKey: string) => {
  const index = selectedScripts.value.indexOf(scriptKey);
  if (index > -1) {
    selectedScripts.value.splice(index, 1);
  } else {
    selectedScripts.value.push(scriptKey);
  }
};

const switchToAdvanced = () => {
  configMode.value = 'advanced';
  // If no processes exist yet, add one
  if (processes.value.length === 0) {
    addProcess();
  }
};

const switchToQuick = () => {
  configMode.value = 'quick';
  selectedScripts.value = [];
};

const canSave = computed(() => {
  if (configMode.value === 'quick') {
    return selectedScripts.value.length > 0;
  }
  return processes.value.some(p => p.name && p.commands.some(c => c.trim()));
});

const handleSave = () => {
  let processesToSave: StartProcess[];

  if (configMode.value === 'quick') {
    // Generate processes from selected scripts
    processesToSave = selectedScripts.value.map(scriptName =>
      generateProcessFromScript(scriptName)
    );
  } else {
    // Use manually configured processes
    processesToSave = processes.value
      .filter(p => p.name && p.commands.some(c => c.trim()))
      .map(p => ({
        ...p,
        commands: p.commands.filter(c => c.trim()),
      }));
  }

  emit('save', processesToSave);
  emit('update:isOpen', false);
};

const handleClose = () => {
  emit('update:isOpen', false);
};
</script>

<template>
  <Sheet :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <SheetContent class="w-full overflow-y-auto px-4 pt-10 sm:max-w-2xl">
      <SheetHeader>
        <SheetTitle>Configure Start Command</SheetTitle>
        <SheetDescription>
          Define processes that will run when you start this project.
        </SheetDescription>
      </SheetHeader>

      <!-- Mode Toggle -->
      <div class="mt-0 flex gap-2 rounded-lg border bg-slate-100 p-1">
        <Button
          :variant="configMode === 'quick' ? 'default' : 'ghost'"
          size="sm"
          @click="switchToQuick"
          class="flex-1"
        >
          <Zap class="mr-2 h-4 w-4" />
          Quick Setup
        </Button>
        <Button
          :variant="configMode === 'advanced' ? 'default' : 'ghost'"
          size="sm"
          @click="switchToAdvanced"
          class="flex-1"
        >
          <Wrench class="mr-2 h-4 w-4" />
          Advanced
        </Button>
      </div>

      <div class="space-y-6">
        <!-- Quick Setup Mode -->
        <div v-if="configMode === 'quick'" class="space-y-4">
          <div class="text-sm text-slate-600">
            Select one or more scripts to run when the project starts.
          </div>

          <div
            v-if="
              (!packageScripts || Object.keys(packageScripts).length === 0) &&
              (!composerScripts || Object.keys(composerScripts).length === 0)
            "
          >
            <div class="rounded-lg border border-dashed p-8 text-center text-slate-500">
              <p>No scripts found</p>
              <p class="mt-2 text-sm">Switch to Advanced mode to configure custom commands.</p>
            </div>
          </div>

          <div v-else class="space-y-4">
            <!-- NPM/Yarn/PNPM Scripts Section -->
            <div v-if="packageScripts && Object.keys(packageScripts).length > 0" class="space-y-2">
              <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {{
                  (detectedPackageManager || 'npm') === 'yarn'
                    ? 'Yarn'
                    : (detectedPackageManager || 'npm') === 'pnpm'
                      ? 'PNPM'
                      : 'NPM'
                }}
                Scripts
              </div>
              <div class="space-y-0">
                <Label
                  v-for="scriptName in Object.keys(packageScripts)"
                  :key="`npm:${scriptName}`"
                  class="flex cursor-pointer items-center space-x-3 rounded-lg border px-4 py-2 hover:bg-slate-100"
                >
                  <Checkbox
                    :id="`script-npm-${scriptName}`"
                    :model-value="selectedScripts.includes(`npm:${scriptName}`)"
                    @update:model-value="toggleScriptSelection(`npm:${scriptName}`)"
                  />
                  <div class="flex-1 cursor-pointer">
                    <div class="font-medium">{{ scriptName }}</div>
                    <div class="text-xs text-slate-500">
                      {{
                        (detectedPackageManager || 'npm') === 'yarn'
                          ? 'yarn'
                          : (detectedPackageManager || 'npm') === 'pnpm'
                            ? 'pnpm'
                            : 'npm run'
                      }}
                      {{ scriptName }}
                    </div>
                  </div>
                </Label>
              </div>
            </div>

            <!-- Composer Scripts Section -->
            <div
              v-if="composerScripts && Object.keys(composerScripts).length > 0"
              class="space-y-2"
            >
              <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Composer Scripts
              </div>
              <div class="space-y-0">
                <Label
                  v-for="scriptName in Object.keys(composerScripts)"
                  :key="`composer:${scriptName}`"
                  class="flex cursor-pointer items-center space-x-3 rounded-lg border px-4 py-2 hover:bg-slate-100"
                >
                  <Checkbox
                    :id="`script-composer-${scriptName}`"
                    :model-value="selectedScripts.includes(`composer:${scriptName}`)"
                    @update:model-value="toggleScriptSelection(`composer:${scriptName}`)"
                  />
                  <div class="flex-1 cursor-pointer">
                    <div class="font-medium">{{ scriptName }}</div>
                    <div class="text-xs text-slate-500">composer {{ scriptName }}</div>
                  </div>
                </Label>
              </div>
            </div>
          </div>

          <div v-if="selectedScripts.length > 0" class="bg-primary-400/25 rounded-lg px-4 py-2">
            <div class="text-primary-900 text-sm font-medium">
              {{ selectedScripts.length }} script{{ selectedScripts.length === 1 ? '' : 's' }}
              selected
            </div>
            <div class="text-primary-700 mt-1 text-xs">
              Each script will run as a separate process with its own terminal.
            </div>
          </div>

          <div
            v-if="
              packageScripts &&
              Object.keys(packageScripts).length > 0 &&
              selectedScripts.length === 0
            "
            class="rounded-lg bg-amber-50 p-4"
          >
            <div class="text-sm text-amber-800">Select at least one script to continue.</div>
          </div>
        </div>

        <!-- Advanced Mode -->
        <div v-if="configMode === 'advanced'" class="space-y-4">
          <div class="text-sm text-slate-600">
            Configure custom processes with full control over commands, working directories, and
            URLs.
          </div>

          <!-- Process List -->
          <div v-if="processes.length === 0" class="py-8 text-center text-slate-500">
            <p>No processes configured yet.</p>
            <p class="text-sm">Click "Add Process" to get started.</p>
          </div>

          <div
            v-for="(process, processIndex) in processes"
            :key="process.id"
            class="space-y-4 rounded-lg border p-4"
          >
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

          <!-- Add Process Button -->
          <Button variant="outline" @click="addProcess" class="w-full">
            <Plus class="mr-2 h-4 w-4" />
            Add Process
          </Button>
        </div>
      </div>

      <SheetFooter class="mt-0 flex-row">
        <SheetClose as-child class="">
          <Button variant="outline" @click="handleClose">Cancel</Button>
        </SheetClose>
        <Button class="" @click="handleSave" :disabled="!canSave">Save Configuration</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
