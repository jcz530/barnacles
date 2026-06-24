<script setup lang="ts">
import { Link, Plus, Terminal, Trash2, Wrench, X, Zap } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { DetectedScriptGroup, StartProcess } from '../../../../shared/types/process';
import type { ApiResponse } from '../../../../shared/types/api';
import { API_ROUTES } from '../../../../shared/constants';
import { useApi } from '../../../composables/useApi';
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
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const processes = ref<StartProcess[]>([]);
const configMode = ref<'quick' | 'advanced'>('quick');
// Format: "type:relativeDir:scriptName" e.g., "npm::dev" (root) or "npm:backend:dev" (subdir)
const selectedScripts = ref<string[]>([]);

// Fetch package scripts, composer scripts, hosts, package manager, and project details for autocomplete
const {
  useProjectPackageScriptsQuery,
  useProjectComposerScriptsQuery,
  useProjectPackageManagerQuery,
  useProjectQuery,
  useHostsQuery,
  useStartProcessesQuery,
  useUpdateStartProcessesMutation,
} = useQueries();
const { data: packageScriptGroups } = useProjectPackageScriptsQuery(props.projectId, {
  enabled: true,
});
const { data: composerScriptGroups } = useProjectComposerScriptsQuery(props.projectId, {
  enabled: true,
});
const { data: _project } = useProjectQuery(props.projectId);
const { data: hosts } = useHostsQuery({ enabled: true });
const { data: startProcesses } = useStartProcessesQuery(props.projectId);
const updateProcessesMutation = useUpdateStartProcessesMutation();
const { apiCall } = useApi();

// Detect the root package manager (used for the root script group's command suggestions)
const { data: detectedPackageManager } = useProjectPackageManagerQuery(props.projectId, {
  enabled: true,
});

// Package manager per subdirectory, resolved lazily as groups are discovered.
// Falls back to the root-detected package manager until resolved.
const subdirPackageManagers = ref<Record<string, 'npm' | 'yarn' | 'pnpm'>>({});

const packageManagerForDir = (relativeDir: string): 'npm' | 'yarn' | 'pnpm' => {
  if (!relativeDir) return detectedPackageManager.value || 'npm';
  return subdirPackageManagers.value[relativeDir] || detectedPackageManager.value || 'npm';
};

// When new package script subdirectories are detected, look up each one's
// package manager so generated commands (yarn/pnpm/npm) are correct per workspace.
watch(
  packageScriptGroups,
  groups => {
    (groups || []).forEach(group => {
      if (!group.relativeDir || subdirPackageManagers.value[group.relativeDir]) return;
      apiCall<ApiResponse<'npm' | 'yarn' | 'pnpm'>>(
        'GET',
        `${API_ROUTES.PROJECTS}/${props.projectId}/package-manager?subPath=${encodeURIComponent(group.relativeDir)}`
      ).then(response => {
        if (response?.data) {
          subdirPackageManagers.value[group.relativeDir] = response.data;
        }
      });
    });
  },
  { immediate: true }
);

const commandForScript = (relativeDir: string, scriptName: string, isComposer: boolean) => {
  if (isComposer) {
    return `composer ${scriptName}`;
  }
  const pkgManager = packageManagerForDir(relativeDir);
  return pkgManager === 'yarn'
    ? `yarn ${scriptName}`
    : pkgManager === 'pnpm'
      ? `pnpm ${scriptName}`
      : `npm run ${scriptName}`;
};

// Generate command suggestions from all detected package script groups and composer script groups
const commandSuggestions = computed(() => {
  const suggestions: string[] = [];

  (packageScriptGroups.value || []).forEach((group: DetectedScriptGroup) => {
    Object.keys(group.scripts).forEach(scriptName => {
      suggestions.push(commandForScript(group.relativeDir, scriptName, false));
    });
  });

  (composerScriptGroups.value || []).forEach((group: DetectedScriptGroup) => {
    Object.keys(group.scripts).forEach(scriptName => {
      suggestions.push(commandForScript(group.relativeDir, scriptName, true));
    });
  });

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

// Build a script key from its parts (format: "type:relativeDir:scriptName").
// relativeDir never contains a colon (it's a folder name), so the remainder
// after the first two colons is always the script name, even if the script
// name itself contains colons (e.g. npm script "test:unit").
const makeScriptKey = (type: 'npm' | 'composer', relativeDir: string, scriptName: string) =>
  `${type}:${relativeDir}:${scriptName}`;

const parseScriptKey = (scriptKey: string) => {
  const firstColon = scriptKey.indexOf(':');
  const secondColon = scriptKey.indexOf(':', firstColon + 1);
  return {
    type: scriptKey.slice(0, firstColon) as 'npm' | 'composer',
    relativeDir: scriptKey.slice(firstColon + 1, secondColon),
    scriptName: scriptKey.slice(secondColon + 1),
  };
};

// Generate process config from a script key
const generateProcessFromScript = (scriptKey: string): StartProcess => {
  const { type, relativeDir, scriptName } = parseScriptKey(scriptKey);
  const colorIndex = selectedScripts.value.length % colorPalette.length;
  const command = commandForScript(relativeDir, scriptName, type === 'composer');

  const label = relativeDir
    ? `${relativeDir} ${scriptName}`
    : scriptName.charAt(0).toUpperCase() + scriptName.slice(1).replace(/-/g, ' ');

  return {
    id: `process-${Date.now()}-${scriptName}`,
    name: label,
    commands: [command],
    color: colorPalette[colorIndex],
    ...(relativeDir ? { workingDir: relativeDir } : {}),
  };
};

// Initialize processes every time the sheet opens. The editor is mounted
// once by its parent and toggled via the isOpen prop, so this can't be
// onMounted-only — that would only load the data on the very first open
// and show stale state on every subsequent reopen.
watch(
  () => props.isOpen,
  isOpen => {
    if (!isOpen) return;

    // Determine mode based on whether we have existing processes
    const hasExistingProcesses = startProcesses.value && startProcesses.value.length > 0;
    configMode.value = hasExistingProcesses ? 'advanced' : 'quick';

    processes.value = startProcesses.value ? JSON.parse(JSON.stringify(startProcesses.value)) : [];

    // Reset selected scripts
    selectedScripts.value = [];
  },
  { immediate: true }
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

const handleSave = async () => {
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

  try {
    await updateProcessesMutation.mutateAsync({
      projectId: props.projectId,
      startProcesses: processesToSave,
    });
    emit('update:isOpen', false);
  } catch (error) {
    console.error('Failed to save process configuration:', error);
    alert('Failed to save process configuration. Please try again.');
  }
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
              (!packageScriptGroups || packageScriptGroups.length === 0) &&
              (!composerScriptGroups || composerScriptGroups.length === 0)
            "
          >
            <div class="rounded-lg border border-dashed p-8 text-center text-slate-500">
              <p>No scripts found</p>
              <p class="mt-2 text-sm">Switch to Advanced mode to configure custom commands.</p>
            </div>
          </div>

          <div v-else class="space-y-4">
            <!-- NPM/Yarn/PNPM Scripts Sections (root + any detected subdirectories) -->
            <div
              v-for="group in packageScriptGroups || []"
              :key="`npm-group:${group.relativeDir}`"
              class="space-y-2"
            >
              <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {{
                  group.relativeDir
                    ? `${group.relativeDir}/package.json`
                    : packageManagerForDir('') === 'yarn'
                      ? 'Yarn'
                      : packageManagerForDir('') === 'pnpm'
                        ? 'PNPM'
                        : 'NPM'
                }}
                Scripts
              </div>
              <div class="space-y-0">
                <Label
                  v-for="scriptName in Object.keys(group.scripts)"
                  :key="makeScriptKey('npm', group.relativeDir, scriptName)"
                  class="flex cursor-pointer items-center space-x-3 rounded-lg border px-4 py-2 hover:bg-slate-100"
                >
                  <Checkbox
                    :id="`script-${makeScriptKey('npm', group.relativeDir, scriptName)}`"
                    :model-value="
                      selectedScripts.includes(makeScriptKey('npm', group.relativeDir, scriptName))
                    "
                    @update:model-value="
                      toggleScriptSelection(makeScriptKey('npm', group.relativeDir, scriptName))
                    "
                  />
                  <div class="flex-1 cursor-pointer">
                    <div class="font-medium">{{ scriptName }}</div>
                    <div class="text-xs text-slate-500">
                      {{ commandForScript(group.relativeDir, scriptName, false) }}
                    </div>
                  </div>
                </Label>
              </div>
            </div>

            <!-- Composer Scripts Sections (root + any detected subdirectories) -->
            <div
              v-for="group in composerScriptGroups || []"
              :key="`composer-group:${group.relativeDir}`"
              class="space-y-2"
            >
              <div class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {{ group.relativeDir ? `${group.relativeDir}/composer.json` : 'Composer' }} Scripts
              </div>
              <div class="space-y-0">
                <Label
                  v-for="scriptName in Object.keys(group.scripts)"
                  :key="makeScriptKey('composer', group.relativeDir, scriptName)"
                  class="flex cursor-pointer items-center space-x-3 rounded-lg border px-4 py-2 hover:bg-slate-100"
                >
                  <Checkbox
                    :id="`script-${makeScriptKey('composer', group.relativeDir, scriptName)}`"
                    :model-value="
                      selectedScripts.includes(
                        makeScriptKey('composer', group.relativeDir, scriptName)
                      )
                    "
                    @update:model-value="
                      toggleScriptSelection(
                        makeScriptKey('composer', group.relativeDir, scriptName)
                      )
                    "
                  />
                  <div class="flex-1 cursor-pointer">
                    <div class="font-medium">{{ scriptName }}</div>
                    <div class="text-xs text-slate-500">
                      {{ commandForScript(group.relativeDir, scriptName, true) }}
                    </div>
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
              packageScriptGroups && packageScriptGroups.length > 0 && selectedScripts.length === 0
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
                  class="text-danger-500 hover:text-danger-600"
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
                :icon="Link"
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
                    :icon="Terminal"
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
