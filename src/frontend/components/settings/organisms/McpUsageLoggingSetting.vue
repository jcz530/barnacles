<script setup lang="ts">
import { computed, ref } from 'vue';
import { Trash2 } from 'lucide-vue-next';
import { useQueries } from '../../../composables/useQueries';
import { usePersistedSetting } from '../../../composables/usePersistedSetting';
import { Switch } from '../../ui/switch';
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
import SettingRow from '../molecules/SettingRow.vue';

const { useSettingsQuery, useUpdateSettingMutation, useEventsQuery, useClearEventsMutation } =
  useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

// Only the total matters here, so ask for the smallest page the API allows.
// No polling: this is a settings row, not the live activity feed.
const eventsQuery = useEventsQuery({ source: 'mcp', limit: 1 }, { refetchInterval: false });
const clearEventsMutation = useClearEventsMutation();

const recordedCount = computed(() => eventsQuery.data.value?.total ?? 0);

const isConfirmOpen = ref(false);

async function clearLog() {
  await clearEventsMutation.mutateAsync({ source: 'mcp' });
  isConfirmOpen.value = false;
}

const RETENTION_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '60', label: '60 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '180 days' },
  { value: '365', label: '1 year' },
];

const { value: usageLogging } = usePersistedSetting<boolean>(() => settingsQuery.data.value, {
  read: data => {
    const stored = data.find(setting => setting.key === SETTING_KEYS.MCP_USAGE_LOGGING);
    return stored === undefined ? undefined : String(stored.value) === 'true';
  },
  write: value =>
    updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.MCP_USAGE_LOGGING,
      value,
      type: 'boolean',
    }),
  initial: true,
});

// Held as a string because the Select binds to string option values; it is
// persisted as a number.
const { value: retentionDays } = usePersistedSetting<string>(() => settingsQuery.data.value, {
  read: data => {
    const stored = data.find(setting => setting.key === SETTING_KEYS.MCP_USAGE_RETENTION_DAYS);
    return stored === undefined ? undefined : String(stored.value);
  },
  write: value =>
    updateSettingMutation.mutateAsync({
      key: SETTING_KEYS.MCP_USAGE_RETENTION_DAYS,
      value: Number(value),
      type: 'number',
    }),
  initial: '90',
});
</script>

<template>
  <div class="space-y-3">
    <SettingRow
      layout="inline"
      label-for="mcp-usage-logging"
      label="MCP usage logging"
      description="Record each MCP tool call — the tool name, whether it succeeded, how long it took, which client made it, and the arguments it was given. Tool results are never recorded. Stays on this machine and powers the MCP page."
    >
      <Switch
        id="mcp-usage-logging"
        aria-labelledby="mcp-usage-logging-label"
        v-model="usageLogging"
        :disabled="updateSettingMutation.isPending.value"
      />
    </SettingRow>

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
