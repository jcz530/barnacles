<script setup lang="ts">
import { inject, ref } from 'vue';
import { useQueries } from '@/composables/useQueries';
import { Button } from '../../ui/button';
import { FolderOpen, Plus } from 'lucide-vue-next';
import FileExplorer from '../../files/organisms/FileExplorer.vue';
import AddRelatedFolderDialog from './AddRelatedFolderDialog.vue';

// Inject project data from parent
const projectId = inject<string>('projectId');

if (!projectId) {
  throw new Error('ProjectRelatedFilesTab must be used within a project detail page');
}

const { useRelatedFoldersQuery, useRemoveRelatedFolderMutation } = useQueries();

// Fetch related folders
const { data: folders, isLoading } = useRelatedFoldersQuery(projectId, { enabled: true });

// Mutations
const removeMutation = useRemoveRelatedFolderMutation();

// Modal state
const isAddDialogOpen = ref(false);

// Sort state
const sortBy = ref<'alphabetical' | 'lastModified'>('alphabetical');

const handleRemoveFolder = async (folderId: string) => {
  // eslint-disable-next-line no-undef
  if (!confirm('Are you sure you want to remove this folder?')) {
    return;
  }

  try {
    await removeMutation.mutateAsync({ projectId, folderId });
  } catch (error) {
    console.error('Failed to remove folder:', error);
  }
};

const handleFolderAdded = () => {
  // Query will auto-refresh via invalidation
};
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Empty state -->
    <div
      v-if="!isLoading && (!folders || folders.length === 0)"
      class="flex flex-1 flex-col items-center justify-center p-8 text-center"
    >
      <div class="rounded-full bg-slate-100 p-4">
        <FolderOpen :size="48" class="text-slate-400" />
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-900">No related folders</h3>
      <p class="mt-2 max-w-sm text-sm text-slate-600">
        Add folders from your file system that are related to this project to quickly browse their
        contents.
      </p>
      <p class="mt-2 text-sm text-slate-500">
        Once setup, you can drag and drop files anywhere on this project to easily move them to your
        related project folders
      </p>
      <Button class="mt-6" @click="isAddDialogOpen = true">
        <Plus :size="16" class="mr-2" />
        Add Folder
      </Button>
    </div>

    <!-- Folders list and explorer -->
    <div v-else class="flex h-full flex-col">
      <!-- Header with add button -->
      <div class="px-6 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Related Folders</h2>
            <p class="text-sm text-slate-600">
              {{ folders?.length || 0 }} folder{{ folders?.length === 1 ? '' : 's' }}
            </p>
          </div>
          <Button @click="isAddDialogOpen = true">
            <Plus :size="16" class="mr-2" />
            Add Folder
          </Button>
        </div>
      </div>

      <!-- File explorer -->
      <div class="flex-1 overflow-hidden">
        <FileExplorer
          v-if="folders && folders.length > 0"
          :root-folders="folders"
          :sort-by="sortBy"
          @update:sort-by="sortBy = $event"
          @remove-folder="handleRemoveFolder"
          class="h-screen"
        />
      </div>
    </div>

    <!-- Add folder dialog -->
    <AddRelatedFolderDialog
      :open="isAddDialogOpen"
      :project-id="projectId"
      @close="isAddDialogOpen = false"
      @added="handleFolderAdded"
    />
  </div>
</template>
