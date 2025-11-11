<script setup lang="ts">
import { ChevronDown, Play, Settings, Square } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import ProcessConfigEditor from '../../process/molecules/ProcessConfigEditor.vue';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useProcessStatusContext } from '@/composables/useProcessStatusContext';

interface Props {
  projectId: string;
  isLoading?: boolean;
}

const props = defineProps<Props>();

// Get process status from context
const { getProjectStatus } = useProcessStatusContext();

const {
  useStartProcessesQuery,
  useStartProjectProcessesMutation,
  useStopProjectProcessesMutation,
  useSettingsQuery,
} = useQueries();

const { data: startProcesses } = useStartProcessesQuery(props.projectId);
const startProcessesMutation = useStartProjectProcessesMutation();
const stopProcessesMutation = useStopProjectProcessesMutation();
const settingsQuery = useSettingsQuery({ enabled: true });

const dropdownOpen = ref(false);
const isConfigEditorOpen = ref(false);

// Get process status from context
const processStatus = computed(() => getProjectStatus(props.projectId));

const hasProcesses = computed(() => {
  return startProcesses.value && startProcesses.value.length > 0;
});

const isProcessRunning = computed(() => {
  const status = processStatus.value;
  if (!status?.processes) return false;
  return status.processes.some(p => p.status === 'running');
});

const processUrls = computed(() => {
  const status = processStatus.value;
  if (!status?.processes) return [];
  return status.processes
    .filter(p => p.status === 'running' && p.url)
    .map(p => ({ url: p.url!, processId: p.processId }));
});

const handleOpenConfigEditor = () => {
  isConfigEditorOpen.value = true;
  dropdownOpen.value = false;
};

const handleStartProcesses = async () => {
  try {
    await startProcessesMutation.mutateAsync(props.projectId);

    // Check auto-open setting
    const autoOpenSetting = settingsQuery.data.value?.find(s => s.key === 'autoOpenProcessUrls');
    const shouldAutoOpen = autoOpenSetting?.value === 'true' || autoOpenSetting?.value === true;

    if (shouldAutoOpen) {
      // Wait a bit for URLs to be detected
      setTimeout(() => {
        const urls = processUrls.value;
        urls.forEach(urlInfo => {
          window.electron?.shell.openExternal(urlInfo.url);
        });
      }, 3000);
    }
  } catch (error) {
    console.error('Failed to start processes:', error);
    alert('Failed to start processes. Please try again.');
  }
};

const handleStopProcesses = async () => {
  try {
    await stopProcessesMutation.mutateAsync(props.projectId);
  } catch (error) {
    console.error('Failed to stop processes:', error);
    alert('Failed to stop processes. Please try again.');
  }
};

const handleMainButtonClick = () => {
  if (!hasProcesses.value) {
    // No processes configured, open config editor
    handleOpenConfigEditor();
  } else if (isProcessRunning.value) {
    // Processes are running, stop them
    handleStopProcesses();
  } else {
    // Processes configured but not running, start them
    handleStartProcesses();
  }
};

const buttonLabel = computed(() => {
  if (!hasProcesses.value) {
    return 'Configure Start';
  }
  return isProcessRunning.value ? '' : '';
});

const buttonVariant = computed(() => {
  if (!hasProcesses.value) {
    return 'secondary';
  }
  return isProcessRunning.value ? 'destructive' : 'success';
});

const buttonIcon = computed(() => {
  if (!hasProcesses.value) {
    return Settings;
  }
  return isProcessRunning.value ? Square : Play;
});
</script>

<template>
  <div class="inline-flex">
    <!-- Main button -->
    <Button
      :variant="buttonVariant"
      size="sm"
      :disabled="
        isLoading || startProcessesMutation.isPending.value || stopProcessesMutation.isPending.value
      "
      @click="handleMainButtonClick"
      class="border-r-primary-foreground/20 rounded-r-none border-r"
    >
      <component :is="buttonIcon" class="mr-2 h-4 w-4" />
      {{ buttonLabel }}
    </Button>

    <!-- Dropdown trigger button -->
    <DropdownMenu v-model:open="dropdownOpen">
      <DropdownMenuTrigger as-child>
        <Button
          :variant="buttonVariant"
          size="sm"
          :disabled="isLoading"
          class="rounded-l-none px-2"
        >
          <ChevronDown class="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @click="handleOpenConfigEditor">
          <Settings class="mr-2 h-4 w-4" />
          Configure Start Command
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Process Config Editor -->
    <ProcessConfigEditor
      :project-id="projectId"
      :is-open="isConfigEditorOpen"
      @update:is-open="isConfigEditorOpen = $event"
    />
  </div>
</template>
