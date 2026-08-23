<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import { useQueries } from '../../../composables/useQueries';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { SETTING_KEYS } from '../../../../shared/types/api';

const { useSettingsQuery, useUpdateSettingMutation, useEventsQuery, useClearEventsMutation } =
  useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

// Only the total matters here, so ask for the smallest page the API allows.
const eventsQuery = useEventsQuery({ source: 'mcp', limit: 1 });
const clearEventsMutation = useClearEventsMutation();

const recordedCount = computed(() => eventsQuery.data.value?.total ?? 0);

const isConfirmOpen = ref(false);

async function clearLog() {
  await clearEventsMutation.mutateAsync({ source: 'mcp' });
  isConfirmOpen.value = false;
}

const usageLogging = ref<boolean>(true);
const retentionDays = ref<string>('90');
const isInitialized = ref(false);

const RETENTION_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

watch(
  () => settingsQuery.data.value,
  newData => {
    if (!newData) return;

    const loggingSetting = newData.find(s => s.key === SETTING_KEYS.MCP_USAGE_LOGGING);
    if (loggingSetting) {
      usageLogging.value = String(loggingSetting.value) === 'true';
    }

    const retentionSetting = newData.find(s => s.key === SETTING_KEYS.MCP_USAGE_RETENTION_DAYS);
    if (retentionSetting) {
      retentionDays.value = String(retentionSetting.value);
    }

    isInitialized.value = true;
  },
  { immediate: true }
);

watch(usageLogging, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.MCP_USAGE_LOGGING,
      value: newValue,
      type: 'boolean',
    });
  }
});

watch(retentionDays, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.MCP_USAGE_RETENTION_DAYS,
      value: Number(newValue),
      type: 'number',
    });
  }
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label for="mcp-usage-logging" class="text-sm font-medium">MCP usage logging</Label>
        <div class="text-muted-foreground text-sm">
          Record each MCP tool call — the tool name, whether it succeeded, how long it took, which
          client made it, and the arguments it was given. Tool results are never recorded. Stays on
          this machine and powers the MCP page.
        </div>
      </div>
      <Switch id="mcp-usage-logging" v-model="usageLogging" class="ml-4 shrink-0" />
    </div>

    <div v-if="usageLogging" class="flex items-center justify-between gap-4">
      <div class="text-muted-foreground text-sm">Delete recorded calls older than</div>
      <Select v-model="retentionDays">
        <SelectTrigger class="h-8 w-32 shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in RETENTION_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="flex items-center justify-between gap-4">
      <div class="text-muted-foreground text-sm">
        <template v-if="recordedCount > 0">
          {{ recordedCount }} recorded {{ recordedCount === 1 ? 'call' : 'calls' }} stored on this
          machine
        </template>
        <template v-else>No recorded calls stored</template>
      </div>

      <AlertDialog v-model:open="isConfirmOpen">
        <AlertDialogTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0"
            :disabled="recordedCount === 0 || clearEventsMutation.isPending.value"
          >
            <Trash2 class="mr-2 h-4 w-4" />
            Delete logs
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MCP usage logs?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all {{ recordedCount }} recorded MCP tool
              {{ recordedCount === 1 ? 'call' : 'calls' }}. Usage counts and activity history on the
              MCP page will be reset. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              class="bg-danger-500 hover:bg-danger-600 text-slate-50"
              :disabled="clearEventsMutation.isPending.value"
              @click="clearLog"
            >
              Delete logs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </div>
</template>
