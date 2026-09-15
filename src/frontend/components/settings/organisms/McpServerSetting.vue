<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ExternalLink } from 'lucide-vue-next';
import { useQueries } from '../../../composables/useQueries';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import McpInstallGuide from '../../mcp/organisms/McpInstallGuide.vue';
import { SETTING_KEYS } from '../../../../shared/types/api';
import { RouteNames } from '../../../router';
import SettingRow from '../molecules/SettingRow.vue';

const emit = defineEmits<{
  'jump-to-setting': [key: (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]];
}>();

const router = useRouter();

const { useSettingsQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });

const isCliInstalled = computed(() => {
  const cliSetting = settingsQuery.data.value?.find(s => s.key === 'installCliCommand');
  return cliSetting ? String(cliSetting.value) === 'true' : false;
});
</script>

<template>
  <div class="space-y-3">
    <SettingRow layout="inline" label="MCP Server">
      <template #label>
        <span class="flex items-center gap-2">
          MCP Server
          <Badge
            v-if="isCliInstalled"
            variant="outline"
            class="text-success-500 border-success-500"
          >
            Available
          </Badge>
          <Badge v-else variant="outline" class="text-muted-foreground"> Requires CLI </Badge>
        </span>
      </template>
      <template #description>
        Lets LLM clients (Claude Code, Claude Desktop, Cursor, Gemini CLI, VS Code, OpenCode, and
        others) start/stop dev processes, read logs, check ports, and look up project info via the
        "barnacles" command.
      </template>
      <Button variant="outline" size="sm" @click="router.push({ name: RouteNames.McpSetup })">
        <ExternalLink class="mr-2 h-4 w-4" />
        Setup guide
      </Button>
    </SettingRow>

    <div v-if="!isCliInstalled" class="flex items-center justify-between gap-3">
      <div class="text-muted-foreground text-sm">
        Enable "Install CLI Command" to make the MCP server available.
      </div>
      <Button
        variant="outline"
        size="sm"
        class="shrink-0"
        @click="emit('jump-to-setting', SETTING_KEYS.INSTALL_CLI_COMMAND)"
      >
        Go to setting
      </Button>
    </div>

    <!-- The full walkthrough lives on the setup page; keep Settings compact. -->
    <McpInstallGuide v-else variant="compact" />
  </div>
</template>
