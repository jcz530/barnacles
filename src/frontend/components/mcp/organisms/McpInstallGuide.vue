<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import CopyButton from '../../atoms/CopyButton.vue';
import {
  MCP_AGENT_INSTRUCTIONS,
  MCP_CLAUDE_CODE_COMMAND,
  MCP_JSON_CONFIG_CLIENTS,
  MCP_JSON_CONFIG_SNIPPET,
  MCP_OPENCODE_CONFIG_SNIPPET,
} from '../../../../shared/constants/mcp-install';

const props = withDefaults(
  defineProps<{
    /**
     * 'full' (setup page) presents agent instructions as a peer section, open by
     * default. 'compact' (Settings) keeps them tucked away behind a collapsed
     * disclosure.
     */
    variant?: 'full' | 'compact';
  }>(),
  { variant: 'full' }
);

const selectedJsonClientValue = ref(MCP_JSON_CONFIG_CLIENTS[0].value);

const selectedJsonClient = computed(
  () =>
    MCP_JSON_CONFIG_CLIENTS.find(client => client.value === selectedJsonClientValue.value) ??
    MCP_JSON_CONFIG_CLIENTS[0]
);

const isAgentInstructionsOpen = ref(props.variant === 'full');
</script>

<template>
  <div class="space-y-4">
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
            <pre class="overflow-x-auto text-xs"><code>{{ MCP_CLAUDE_CODE_COMMAND }}</code></pre>
            <div class="absolute top-2 right-2">
              <CopyButton :value="MCP_CLAUDE_CODE_COMMAND" title="Copy command" />
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
                v-for="client in MCP_JSON_CONFIG_CLIENTS"
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
            <pre class="overflow-x-auto text-xs"><code>{{ MCP_JSON_CONFIG_SNIPPET }}</code></pre>
            <div class="absolute top-2 right-2">
              <CopyButton :value="MCP_JSON_CONFIG_SNIPPET" title="Copy config" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="opencode" class="space-y-2">
          <div class="text-muted-foreground text-sm">
            Add this to <code>opencode.json</code>, then restart OpenCode:
          </div>
          <div class="bg-muted relative rounded-md p-3">
            <pre
              class="overflow-x-auto text-xs"
            ><code>{{ MCP_OPENCODE_CONFIG_SNIPPET }}</code></pre>
            <div class="absolute top-2 right-2">
              <CopyButton :value="MCP_OPENCODE_CONFIG_SNIPPET" title="Copy config" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>

    <Collapsible v-model:open="isAgentInstructionsOpen">
      <CollapsibleTrigger class="flex w-full cursor-pointer items-center justify-between text-left">
        <div class="space-y-0.5">
          <span
            :class="
              variant === 'full' ? 'text-lg font-semibold text-slate-800' : 'text-sm font-medium'
            "
            >Agent instructions</span
          >
          <div class="text-muted-foreground text-sm">
            Paste into <code>CLAUDE.md</code> / <code>AGENTS.md</code> so the agent knows when to
            use these tools.
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
          ><code>{{ MCP_AGENT_INSTRUCTIONS }}</code></pre>
          <div class="absolute top-2 right-2">
            <CopyButton :value="MCP_AGENT_INSTRUCTIONS" title="Copy instructions" />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
