<script setup lang="ts">
import { MoreVertical } from 'lucide-vue-next';
import { Button } from '../../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import ProjectActionsDropdownContent from '@/components/projects/molecules/ProjectActionsDropdownContent.vue';

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
  processStatuses?: any;
}

defineProps<Props>();
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
        />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
