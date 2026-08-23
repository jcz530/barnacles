<script setup lang="ts">
import { computed, ref } from 'vue';
import type { SortingState } from '@tanstack/vue-table';
import { BookOpen, Plug, Trash2 } from 'lucide-vue-next';
import ViewToggle from '../components/atoms/ViewToggle.vue';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import McpToolsTable from '../components/mcp/organisms/McpToolsTable.vue';
import McpEventsTable from '../components/mcp/organisms/McpEventsTable.vue';
import McpUsageStats from '../components/mcp/molecules/McpUsageStats.vue';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import { useViewMode } from '@/composables/useViewMode';
import {
  MCP_TOOLS,
  MCP_TOOL_CATEGORIES,
  type McpToolCategory,
} from '../../shared/constants/mcp-tools';
import { SETTING_KEYS } from '../../shared/types/api';
import { RouteNames } from '../router';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'MCP' }]);

const {
  useSettingsQuery,
  useUpdateSettingMutation,
  useEventCountsQuery,
  useEventsQuery,
  useEventSeriesQuery,
  useClearEventsMutation,
} = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();
const countsQuery = useEventCountsQuery({ source: 'mcp' });
const seriesQuery = useEventSeriesQuery({ source: 'mcp', days: 14 });
const eventsQuery = useEventsQuery({ source: 'mcp', limit: 50 });
const clearEventsMutation = useClearEventsMutation();

const isCliInstalled = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === SETTING_KEYS.INSTALL_CLI_COMMAND);
  return setting ? String(setting.value) === 'true' : false;
});

/** Enable the CLI in place rather than sending the user off to Settings. */
async function enableCli() {
  await updateSettingMutation.mutateAsync({
    key: SETTING_KEYS.INSTALL_CLI_COMMAND,
    value: true,
    type: 'boolean',
  });
}

const viewMode = useViewMode('mcp-tools-view-mode', 'table');
const tableSorting = ref<SortingState>([{ id: 'total', desc: true }]);

const counts = computed(() => countsQuery.data.value ?? []);
const series = computed(() => seriesQuery.data.value ?? []);
const events = computed(() => eventsQuery.data.value?.events ?? []);
const eventTotal = computed(() => eventsQuery.data.value?.total ?? 0);

const activitySorting = ref<SortingState>([{ id: 'occurredAt', desc: true }]);

async function clearLog() {
  await clearEventsMutation.mutateAsync({ source: 'mcp' });
}

const totalCalls = computed(() => counts.value.reduce((sum, c) => sum + c.total, 0));
const toolsUsed = computed(() => counts.value.filter(c => c.total > 0).length);

const categories = computed(() =>
  MCP_TOOL_CATEGORIES.map(category => ({
    ...category,
    tools: MCP_TOOLS.filter(tool => tool.category === (category.value as McpToolCategory)),
  })).filter(group => group.tools.length > 0)
);
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="p-6 pb-0">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-bold text-slate-800">MCP Server</h1>
            <Badge
              v-if="isCliInstalled"
              variant="outline"
              class="text-success-500 border-success-500"
            >
              Available
            </Badge>
            <Badge v-else variant="outline" class="text-muted-foreground">Requires CLI</Badge>
          </div>
          <p class="mt-1 max-w-3xl text-sm text-slate-600">
            Let your coding agent drive your barnacles directly.
          </p>
          <p class="mt-1 max-w-3xl text-sm text-slate-600">
            Start and stop dev servers, read logs, check ports, and look up project info, without
            leaving the chat.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="shrink-0"
          @click="$router.push({ name: RouteNames.McpSetup })"
        >
          <BookOpen class="mr-2 h-4 w-4" />
          Setup guide
        </Button>
      </div>
    </div>

    <div class="flex-1 space-y-8 overflow-y-auto p-6 pt-4">
      <!-- Only surfaced when there is something to act on; the full walkthrough
           lives on the setup page. -->
      <section
        v-if="!isCliInstalled"
        class="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <div class="text-sm text-slate-600">
          The MCP server runs through the <code>barnacles</code> CLI command, which isn't installed
          yet.
        </div>
        <Button
          size="sm"
          class="shrink-0"
          :disabled="updateSettingMutation.isPending.value"
          @click="enableCli"
        >
          <Plug class="mr-2 h-4 w-4" />
          Install CLI command
        </Button>
      </section>

      <!-- Usage -->
      <section v-if="isCliInstalled">
        <h2 class="mb-3 text-lg font-semibold text-slate-800">Usage</h2>
        <McpUsageStats
          :counts="counts"
          :series="series"
          :total-tools="MCP_TOOLS.length"
          :is-loading="countsQuery.isLoading.value"
        />
      </section>

      <!-- Tools -->
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Tools</h2>
            <p class="text-sm text-slate-600">
              {{ MCP_TOOLS.length }} tools available<span v-if="totalCalls > 0">
                · {{ totalCalls }} calls across {{ toolsUsed }} of
                {{ MCP_TOOLS.length }} tools</span
              >
            </p>
          </div>
          <ViewToggle :current-view="viewMode" @update:view="viewMode = $event" />
        </div>

        <div class="space-y-6">
          <div v-for="group in categories" :key="group.value">
            <h3 class="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">
              {{ group.label }}
            </h3>
            <McpToolsTable
              :tools="group.tools"
              :counts="counts"
              :view-mode="viewMode"
              :sorting="tableSorting"
              @update:sorting="tableSorting = $event"
            />
          </div>
        </div>
      </section>

      <!-- Activity -->
      <section v-if="isCliInstalled">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-800">Recent activity</h2>
            <p class="text-sm text-slate-600">
              <template v-if="eventTotal > 0">
                Showing {{ events.length }} of {{ eventTotal }} calls · arguments are recorded,
                results never are
              </template>
              <template v-else>Every tool call an agent makes will appear here</template>
            </p>
          </div>
          <Button
            v-if="eventTotal > 0"
            variant="outline"
            size="sm"
            :disabled="clearEventsMutation.isPending.value"
            @click="clearLog"
          >
            <Trash2 class="mr-2 h-4 w-4" />
            Clear log
          </Button>
        </div>

        <McpEventsTable
          :events="events"
          :is-loading="eventsQuery.isLoading.value"
          :sorting="activitySorting"
          @update:sorting="activitySorting = $event"
        />
      </section>
    </div>
  </div>
</template>
