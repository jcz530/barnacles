<script setup lang="ts">
import { computed } from 'vue';
import { ArrowLeft, Plug } from 'lucide-vue-next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import McpInstallGuide from '../components/mcp/organisms/McpInstallGuide.vue';
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import { RouteNames } from '../router';
import { MCP_TOOLS, MCP_TOOL_CATEGORIES } from '../../shared/constants/mcp-tools';
import { SETTING_KEYS } from '../../shared/types/api';

const { setBreadcrumbs } = useBreadcrumbs();
setBreadcrumbs([{ label: 'MCP', href: '/mcp' }, { label: 'Setup' }]);

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

const isCliInstalled = computed(() => {
  const setting = settingsQuery.data.value?.find(s => s.key === SETTING_KEYS.INSTALL_CLI_COMMAND);
  return setting ? String(setting.value) === 'true' : false;
});

async function enableCli() {
  await updateSettingMutation.mutateAsync({
    key: SETTING_KEYS.INSTALL_CLI_COMMAND,
    value: true,
    type: 'boolean',
  });
}

/** What each tool group lets an agent do, in plain language. */
const capabilities = [
  {
    category: 'projects',
    summary: 'Look up tracked projects, their git status, READMEs, run scripts, and accounts.',
  },
  {
    category: 'processes',
    summary: 'Start and stop dev servers, read their output, and see what is already running.',
  },
  { category: 'ports', summary: 'See what is listening locally and free a port when asked.' },
  { category: 'system', summary: 'Read local domain overrides from the hosts file.' },
  {
    category: 'utilities',
    summary: 'Convert colors, generate palettes, and read or strip EXIF data.',
  },
];

const capabilityRows = computed(() =>
  capabilities.map(entry => ({
    ...entry,
    label: MCP_TOOL_CATEGORIES.find(c => c.value === entry.category)?.label ?? entry.category,
    count: MCP_TOOLS.filter(tool => tool.category === entry.category).length,
  }))
);
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="p-6 pb-0">
      <Button
        variant="ghost"
        size="sm"
        class="mb-3 -ml-2"
        @click="$router.push({ name: RouteNames.Mcp })"
      >
        <ArrowLeft class="mr-2 h-4 w-4" />
        Back to MCP
      </Button>

      <div class="flex items-center gap-3">
        <h1 class="text-3xl font-bold text-slate-800">Set up the MCP server</h1>
        <Badge v-if="isCliInstalled" variant="outline" class="text-success-500 border-success-500">
          Available
        </Badge>
        <Badge v-else variant="outline" class="text-muted-foreground">Requires CLI</Badge>
      </div>
      <p class="mt-1 max-w-3xl text-sm text-slate-600">
        Connect a coding agent once, and it can drive your barnacles for the rest of the session.
      </p>
    </div>

    <div class="flex-1 space-y-8 overflow-y-auto p-6 pt-6">
      <!-- What it is -->
      <section class="max-w-3xl space-y-3">
        <h2 class="text-lg font-semibold text-slate-800">What is MCP?</h2>
        <p class="text-sm text-slate-600">
          The Model Context Protocol is a standard way for an AI client (Claude Code, Claude
          Desktop, Cursor, and others) to call tools on your machine. Barnacles ships an MCP server,
          so instead of describing your setup to an agent every time, it can look the answers up
          itself.
        </p>
        <p class="text-sm text-slate-600">
          The server runs locally as <code class="text-slate-800">barnacles mcp</code> and talks to
          this app over your own machine's loopback interface. Nothing is sent anywhere else.
        </p>
      </section>

      <!-- What it can do -->
      <section class="max-w-3xl">
        <h2 class="mb-3 text-lg font-semibold text-slate-800">
          What your agent can do ({{ MCP_TOOLS.length }} tools)
        </h2>
        <div class="divide-y divide-slate-200 rounded-lg border border-slate-200">
          <div
            v-for="row in capabilityRows"
            :key="row.category"
            class="flex items-baseline gap-4 p-3"
          >
            <div class="w-24 shrink-0">
              <span class="text-sm font-medium text-slate-800">{{ row.label }}</span>
            </div>
            <p class="flex-1 text-sm text-slate-600">{{ row.summary }}</p>
            <span class="shrink-0 text-xs text-slate-400">{{ row.count }}</span>
          </div>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          The full tool list, with usage counts, is on the
          <RouterLink :to="{ name: RouteNames.Mcp }" class="text-primary-600 underline"
            >MCP page</RouterLink
          >.
        </p>
      </section>

      <!-- Install -->
      <section class="max-w-3xl">
        <h2 class="mb-3 text-lg font-semibold text-slate-800">Connect a client</h2>

        <div
          v-if="!isCliInstalled"
          class="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          <div class="text-sm text-slate-600">
            The MCP server runs through the <code>barnacles</code> CLI command, which isn't
            installed yet.
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
        </div>

        <McpInstallGuide v-else />
      </section>

      <!-- Privacy -->
      <section class="max-w-3xl space-y-2">
        <h2 class="text-lg font-semibold text-slate-800">Local only logging</h2>
        <p class="text-sm text-slate-600">
          Each tool call is logged locally so the MCP page can show what your agent actually uses:
          the tool name, whether it succeeded, how long it took, which client called it, and the
          arguments it was given. Values that look like credentials are redacted, and
          <strong class="font-medium text-slate-700">tool results are never recorded</strong>.
        </p>
        <p class="text-sm text-slate-600">
          Under Settings → Developer Tools you can turn logging off, choose how long calls are kept,
          and delete everything recorded so far.
        </p>
      </section>
    </div>
  </div>
</template>
