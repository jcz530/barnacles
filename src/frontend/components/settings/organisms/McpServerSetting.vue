<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueries } from '../../../composables/useQueries';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { ChevronDown } from 'lucide-vue-next';
import CopyButton from '../../atoms/CopyButton.vue';
import { SETTING_KEYS } from '../../../../shared/types/api';

const emit = defineEmits<{
  'jump-to-setting': [key: (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]];
}>();

const { useSettingsQuery } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });

const isCliInstalled = computed(() => {
  const cliSetting = settingsQuery.data.value?.find(s => s.key === 'installCliCommand');
  return cliSetting ? String(cliSetting.value) === 'true' : false;
});

const isAgentInstructionsOpen = ref(false);

const claudeCodeCommand = 'claude mcp add barnacles -- barnacles mcp';

interface JsonConfigClient {
  value: string;
  label: string;
  path: string;
  reload: string;
}

const jsonConfigClients: JsonConfigClient[] = [
  {
    value: 'claude-desktop',
    label: 'Claude Desktop',
    path: 'claude_desktop_config.json',
    reload: 'restart Claude Desktop',
  },
  {
    value: 'cursor',
    label: 'Cursor',
    path: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)',
    reload: 'reload Cursor',
  },
  {
    value: 'gemini-cli',
    label: 'Gemini CLI',
    path: '.gemini/settings.json (project) or ~/.gemini/settings.json (global)',
    reload: 'restart Gemini CLI',
  },
  {
    value: 'vscode',
    label: 'VS Code',
    path: '.vscode/mcp.json',
    reload: 'reload the VS Code window',
  },
  {
    value: 'windsurf',
    label: 'Windsurf',
    path: '~/.codeium/windsurf/mcp_config.json',
    reload: 'restart Windsurf',
  },
];

const selectedJsonClientValue = ref(jsonConfigClients[0].value);

const selectedJsonClient = computed(
  () =>
    jsonConfigClients.find(client => client.value === selectedJsonClientValue.value) ??
    jsonConfigClients[0]
);

const jsonConfigSnippet = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        barnacles: {
          command: 'barnacles',
          args: ['mcp'],
        },
      },
    },
    null,
    2
  )
);

const opencodeConfigSnippet = computed(() =>
  JSON.stringify(
    {
      mcp: {
        barnacles: {
          type: 'local',
          command: ['barnacles', 'mcp'],
          enabled: true,
        },
      },
    },
    null,
    2
  )
);

const agentInstructions = `## Barnacles MCP

This project is managed by Barnacles. Prefer the \`barnacles\` MCP tools over ad-hoc shell commands for the following:

- Starting or stopping the dev server(s) — use \`start_project_process\` / \`stop_project_process\` instead of running \`npm run dev\` directly, so the process is tracked and visible in the Barnacles UI.
- Reading dev server logs — use \`get_process_output\` instead of re-running the command or tailing a log file.
- Checking what's already running — use \`list_running_processes\` before starting a process, to avoid spawning duplicates.
- Checking port usage — use \`list_ports\` to see what's listening, and \`kill_port_process\` to free a port (irreversible, only do this when asked).
- Looking up project info — use \`list_projects\`, \`get_project_status\`, \`get_project_readme\`, and \`get_project_scripts\` instead of guessing paths or re-reading files already indexed by Barnacles.
- Checking local domain overrides — use \`get_hosts_entries\` instead of reading /etc/hosts directly.
- Project credentials — use \`list_project_accounts\` to see what accounts exist (passwords are never exposed); use \`open_project_accounts\` to have the user view a password themselves in the app.

Always call \`list_projects\` first if you don't already know the project ID.`;
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">MCP Server</span>
          <Badge
            v-if="isCliInstalled"
            variant="outline"
            class="text-success-500 border-success-500"
          >
            Available
          </Badge>
          <Badge v-else variant="outline" class="text-muted-foreground"> Requires CLI </Badge>
        </div>
        <div class="text-muted-foreground text-sm">
          Lets LLM clients (Claude Code, Claude Desktop, Cursor, Gemini CLI, VS Code, OpenCode, and
          others) start/stop dev processes, read logs, check ports, and look up project info via the
          "barnacles" command.
        </div>
      </div>
    </div>

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

    <div v-else class="space-y-4">
      <div class="space-y-2">
        <div class="text-muted-foreground text-sm">Connect your MCP client:</div>

        <Tabs default-value="claude-code">
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="claude-code" class="text-xs">Claude Code</TabsTrigger>
            <TabsTrigger value="json-config" class="text-xs">JSON config</TabsTrigger>
            <TabsTrigger value="opencode" class="text-xs">OpenCode</TabsTrigger>
          </TabsList>

          <TabsContent value="claude-code" class="space-y-2">
            <div class="text-muted-foreground text-sm">
              Run this in your terminal — no config file editing needed:
            </div>
            <div class="bg-muted relative rounded-md p-3">
              <pre class="overflow-x-auto text-xs"><code>{{ claudeCodeCommand }}</code></pre>
              <div class="absolute top-2 right-2">
                <CopyButton :value="claudeCodeCommand" title="Copy command" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="json-config" class="space-y-2">
            <Select v-model="selectedJsonClientValue">
              <SelectTrigger class="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="client in jsonConfigClients"
                  :key="client.value"
                  :value="client.value"
                >
                  {{ client.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="text-muted-foreground text-sm">
              Add this to <code>{{ selectedJsonClient.path }}</code
              >, then {{ selectedJsonClient.reload }}:
            </div>
            <div class="bg-muted relative rounded-md p-3">
              <pre class="overflow-x-auto text-xs"><code>{{ jsonConfigSnippet }}</code></pre>
              <div class="absolute top-2 right-2">
                <CopyButton :value="jsonConfigSnippet" title="Copy config" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="opencode" class="space-y-2">
            <div class="text-muted-foreground text-sm">
              Add this to <code>opencode.json</code>, then restart OpenCode:
            </div>
            <div class="bg-muted relative rounded-md p-3">
              <pre class="overflow-x-auto text-xs"><code>{{ opencodeConfigSnippet }}</code></pre>
              <div class="absolute top-2 right-2">
                <CopyButton :value="opencodeConfigSnippet" title="Copy config" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Collapsible v-model:open="isAgentInstructionsOpen">
        <CollapsibleTrigger class="flex w-full items-center justify-between text-left">
          <div class="space-y-0.5">
            <span class="text-sm font-medium">Agent instructions</span>
            <div class="text-muted-foreground text-sm">
              Optional: paste into <code>CLAUDE.md</code> / <code>AGENTS.md</code> so the agent
              knows when to use these tools.
            </div>
          </div>
          <ChevronDown
            class="h-4 w-4 shrink-0 transition-transform"
            :class="{ 'rotate-180': isAgentInstructionsOpen }"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="bg-muted relative mt-2 rounded-md p-3">
            <pre
              class="overflow-x-auto text-xs whitespace-pre-wrap"
            ><code>{{ agentInstructions }}</code></pre>
            <div class="absolute top-2 right-2">
              <CopyButton :value="agentInstructions" title="Copy instructions" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
