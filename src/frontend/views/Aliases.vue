<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import type { Alias } from '@/shared/types/api';
import type { SortingState } from '@tanstack/vue-table';
import { RouteNames } from '@/router';
import {
  AlertCircle,
  Check,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';
import AliasesTable from '../components/aliases/organisms/AliasesTable.vue';
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import CopyButton from '@/components/atoms/CopyButton.vue';

const { setBreadcrumbs } = useBreadcrumbs();
const {
  useAliasesQuery,
  useAliasesConfigPathQuery,
  useCreateAliasMutation,
  useUpdateAliasMutation,
  useDeleteAliasMutation,
  useSyncAliasesMutation,
} = useQueries();

onMounted(() => {
  setBreadcrumbs([{ label: 'Aliases' }]);
});

// Query for fetching aliases
const { data: aliasesData, isLoading, refetch } = useAliasesQuery({ enabled: true });

// Query for fetching config path
const { data: configInfo, refetch: refetchConfigInfo } = useAliasesConfigPathQuery({
  enabled: true,
});

// Local state for editing
const editedAliases = ref<Alias[]>([]);
const newAliases = ref<Alias[]>([]);
const searchQuery = ref('');
const sorting = ref<SortingState>([{ id: 'name', desc: false }]);

// Track which fields have been modified
const modifiedFields = computed(() => {
  const modified: Record<
    string,
    { name: boolean; command: boolean; description: boolean; showCommand: boolean }
  > = {};

  if (!aliasesData.value) return modified;

  editedAliases.value.forEach((editedAlias: Alias) => {
    const original = aliasesData.value?.find(a => a.id === editedAlias.id);
    if (original) {
      modified[editedAlias.id] = {
        name: editedAlias.name !== original.name,
        command: editedAlias.command !== original.command,
        description: editedAlias.description !== original.description,
        showCommand: editedAlias.showCommand !== original.showCommand,
      };
    }
  });

  return modified;
});

const hasUnsavedChanges = computed(() => {
  if (!aliasesData.value) return false;
  const hasEditedChanges =
    JSON.stringify(editedAliases.value) !== JSON.stringify(aliasesData.value);
  const hasNewEntries = newAliases.value.length > 0;
  return hasEditedChanges || hasNewEntries;
});

// Watch for data changes to initialize edited aliases
const aliases = computed(() => {
  if (aliasesData.value && editedAliases.value.length === 0 && newAliases.value.length === 0) {
    editedAliases.value = aliasesData.value.map(a => ({ ...a }));
  }
  return editedAliases.value;
});

// Watch for aliasesData changes and reset local state if no unsaved changes
watch(
  aliasesData,
  (newData, oldData) => {
    // Only update if data actually changed and there are no unsaved changes
    if (
      newData &&
      JSON.stringify(newData) !== JSON.stringify(oldData) &&
      !hasUnsavedChanges.value
    ) {
      editedAliases.value = newData.map(a => ({ ...a }));
      newAliases.value = [];
    }
  },
  { deep: true }
);

// Mutations
const createMutation = useCreateAliasMutation();
const updateMutation = useUpdateAliasMutation();
const deleteMutation = useDeleteAliasMutation();
const syncMutation = useSyncAliasesMutation();

// Add new alias entry
const addAlias = () => {
  const maxOrder = Math.max(
    0,
    ...editedAliases.value.map((a: Alias) => a.order),
    ...newAliases.value.map((a: Alias) => a.order)
  );
  const newAlias: Alias = {
    id: `new-${Date.now()}`,
    name: '',
    command: '',
    description: null,
    color: null,
    showCommand: true,
    category: 'custom',
    order: maxOrder + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  newAliases.value.push(newAlias);
};

// Remove alias entry
const removeAlias = (id: string, isNew: boolean = false) => {
  if (isNew) {
    newAliases.value = newAliases.value.filter((a: Alias) => a.id !== id);
  } else {
    editedAliases.value = editedAliases.value.filter((a: Alias) => a.id !== id);
  }
};

// Update alias entry (existing aliases)
const updateAlias = (id: string, field: keyof Alias, value: unknown) => {
  const alias = editedAliases.value.find((a: Alias) => a.id === id);
  if (alias) {
    (alias[field] as typeof value) = value;
  }
};

// Update new alias entry
const updateNewAlias = (id: string, field: keyof Alias, value: unknown) => {
  const alias = newAliases.value.find((a: Alias) => a.id === id);
  if (alias) {
    (alias[field] as typeof value) = value;
  }
};

// Save changes
const saveChanges = async () => {
  try {
    // Delete removed aliases
    if (aliasesData.value) {
      const currentIds = new Set(editedAliases.value.map((a: Alias) => a.id));
      const removedAliases = aliasesData.value.filter(a => !currentIds.has(a.id));
      for (const alias of removedAliases) {
        await deleteMutation.mutateAsync(alias.id);
      }
    }

    // Update existing aliases
    for (const alias of editedAliases.value) {
      const original = aliasesData.value?.find(a => a.id === alias.id);
      if (original) {
        // Check if any field has actually changed
        const hasChanges =
          alias.name !== original.name ||
          alias.command !== original.command ||
          alias.description !== original.description ||
          alias.color !== original.color ||
          alias.showCommand !== original.showCommand ||
          alias.category !== original.category ||
          alias.order !== original.order;

        if (hasChanges) {
          await updateMutation.mutateAsync({
            id: alias.id,
            data: {
              name: alias.name,
              command: alias.command,
              description: alias.description || undefined,
              color: alias.color || undefined,
              showCommand: alias.showCommand,
              category: alias.category,
              order: alias.order,
            },
          });
        }
      }
    }

    // Create new aliases
    for (const alias of newAliases.value) {
      await createMutation.mutateAsync({
        name: alias.name,
        command: alias.command,
        description: alias.description || undefined,
        color: alias.color || undefined,
        showCommand: alias.showCommand,
        category: alias.category,
        order: alias.order,
      });
    }

    // Sync aliases to shell
    await syncMutation.mutateAsync();

    // Refetch to get the latest data from the server
    await refetch();

    // Clear local state AFTER refetch so the UI updates with fresh data
    editedAliases.value = [];
    newAliases.value = [];
  } catch (error) {
    console.error('Failed to save aliases:', error);
  }
};

// Discard changes
const discardChanges = () => {
  if (aliasesData.value) {
    editedAliases.value = aliasesData.value.map(a => ({ ...a }));
  }
  newAliases.value = [];
};

// Refresh data
const refreshData = async () => {
  editedAliases.value = [];
  newAliases.value = [];
  await Promise.all([refetch(), refetchConfigInfo()]);
};

// Validate alias name
const isValidAliasName = (name: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(name);
};

// Check if form is valid
const isFormValid = computed(() => {
  const allAliases = [...editedAliases.value, ...newAliases.value];
  return allAliases.every(
    alias => alias.name.length > 0 && isValidAliasName(alias.name) && alias.command.length > 0
  );
});
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-semibold">Terminal Aliases</h2>
          <p class="text-muted-foreground mt-1">
            Create and manage custom terminal shortcuts with colors and presets
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="{ name: RouteNames.PresetPacks }">
              <Package class="mr-2 h-4 w-4" />
              Preset Packs
            </RouterLink>
          </Button>
          <Button @click="refreshData" variant="outline" size="sm" :disabled="isLoading">
            <RefreshCw :class="{ 'animate-spin': isLoading }" class="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <!-- Config File Path Display -->
      <div
        v-if="configInfo"
        class="bg-muted/50 mb-4 flex items-center justify-between rounded-lg border px-4 py-3"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground text-sm font-medium">Config File:</span>
            <code class="text-foreground bg-background rounded px-2 py-1 font-mono text-sm">{{
              configInfo.path
            }}</code>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground text-sm font-medium">Shell:</span>
            <code class="text-foreground bg-background rounded px-2 py-1 font-mono text-sm">{{
              configInfo.shell
            }}</code>
          </div>
        </div>
        <CopyButton :value="configInfo.path" label="Copy Path" />
      </div>

      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Alias Entries</CardTitle>
              <CardDescription>
                Define shortcuts for frequently used commands. Changes are synced to your shell
                profile.
              </CardDescription>
            </div>
            <div class="flex gap-2">
              <div class="relative">
                <Search
                  class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                />
                <Input v-model="searchQuery" placeholder="Search aliases..." class="w-64 pl-9" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="isLoading" class="flex items-center justify-center py-8">
            <RefreshCw class="text-muted-foreground h-6 w-6 animate-spin" />
          </div>

          <div v-else class="space-y-4">
            <!-- Aliases Table -->
            <AliasesTable
              :aliases="aliases"
              :search-query="searchQuery"
              :sorting="sorting"
              :modified-fields="modifiedFields"
              :new-aliases="newAliases"
              @update:sorting="val => (sorting = val)"
              @update:search-query="val => (searchQuery = val)"
              @update:alias="updateAlias"
              @update:new-alias="updateNewAlias"
              @remove:alias="id => removeAlias(id, false)"
              @remove:new-alias="id => removeAlias(id, true)"
            />

            <!-- Add Button -->
            <div>
              <Button @click="addAlias" variant="outline" class="w-full">
                <Plus class="mr-2 h-4 w-4" />
                Add Alias
              </Button>
            </div>

            <!-- Validation Warning -->
            <div
              v-if="hasUnsavedChanges && !isFormValid"
              class="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3"
            >
              <AlertCircle class="mt-0.5 h-5 w-5 text-yellow-600" />
              <div class="text-sm text-yellow-800">
                <p class="font-medium">Invalid entries detected</p>
                <p class="mt-1">
                  Alias names can only contain letters, numbers, underscores, and hyphens. Both name
                  and command are required.
                </p>
              </div>
            </div>

            <!-- Info Message -->
            <div
              class="bg-primary-50 border-primary-200 flex items-start gap-2 rounded-lg border p-3"
            >
              <Sparkles class="text-primary-600 mt-0.5 h-5 w-5" />
              <div class="text-primary-800 text-sm">
                <p class="font-medium">Shell restart required</p>
                <p class="mt-1">
                  After saving, restart your terminal or run
                  <code class="bg-primary-100 rounded px-1 font-mono">source ~/.zshrc</code> (or
                  <code class="bg-primary-100 rounded px-1 font-mono">~/.bashrc</code>) to apply
                  changes.
                </p>
              </div>
            </div>

            <!-- Error Message -->
            <div
              v-if="syncMutation.isError.value"
              class="bg-danger-50 border-danger-200 flex items-start gap-2 rounded-lg border p-3"
            >
              <AlertCircle class="text-danger-600 mt-0.5 h-5 w-5" />
              <div class="text-danger-800 text-sm">
                <p class="font-medium">Failed to sync aliases</p>
                <p class="mt-1">{{ syncMutation.error.value?.message || 'Unknown error' }}</p>
              </div>
            </div>

            <!-- Success Message -->
            <div
              v-if="syncMutation.isSuccess.value && !hasUnsavedChanges"
              class="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3"
            >
              <Check class="mt-0.5 h-5 w-5 text-green-600" />
              <div class="text-sm text-green-800">
                <p class="font-medium">Aliases saved and synced successfully</p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-2 border-t pt-4">
              <Button @click="discardChanges" :disabled="!hasUnsavedChanges" variant="outline"
                >Discard Changes</Button
              >
              <Button
                @click="saveChanges"
                :disabled="!hasUnsavedChanges || !isFormValid || syncMutation.isPending.value"
              >
                <Save class="mr-2 h-4 w-4" />
                {{ syncMutation.isPending.value ? 'Saving...' : 'Save & Sync' }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  </div>
</template>
