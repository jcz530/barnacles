<script setup lang="ts">
import { MoreVertical } from 'lucide-vue-next';
import { ref } from 'vue';
import { Button } from '../../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import ProjectActionsDropdownContent from '@/components/projects/molecules/ProjectActionsDropdownContent.vue';
import ProcessConfigEditor from '@/components/process/molecules/ProcessConfigEditor.vue';

interface Props {
  projectId: string;
  projectPath: string;
  projectName: string;
  isArchived: boolean;
  isFavorite: boolean;
  gitRemoteUrl?: string | null;
  thirdPartySize?: number | null;
  preferredIdeId?: string | null;
  preferredTerminalId?: string | null;
}

defineProps<Props>();

const isConfigEditorOpen = ref(false);
</script>

<template>
  <div>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm">
          <MoreVertical class="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ProjectActionsDropdownContent
          :project-id="projectId"
          :project-path="projectPath"
          :project-name="projectName"
          :is-archived="isArchived"
          :is-favorite="isFavorite"
          :git-remote-url="gitRemoteUrl"
          :third-party-size="thirdPartySize"
          :preferred-ide-id="preferredIdeId"
          :preferred-terminal-id="preferredTerminalId"
          @open-config-editor="isConfigEditorOpen = true"
        />
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Process Config Editor -->
    <ProcessConfigEditor
      v-if="isConfigEditorOpen"
      :project-id="projectId"
      :is-open="isConfigEditorOpen"
      @update:is-open="isConfigEditorOpen = $event"
    />
  </div>
</template>
