<script setup lang="ts">
import { useQueries } from '@/composables/useQueries';
import { AlertCircle, Check, Package } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';

interface Props {
  open: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  installed: [];
}>();

const { usePresetsQuery, useInstallPresetMutation } = useQueries();

const { data: presets, isLoading } = usePresetsQuery({ enabled: true });
const installMutation = useInstallPresetMutation();

const selectedPack = ref<string | null>(null);
const selectedAliases = ref<Set<string>>(new Set());

// Watch for modal open/close to reset state
watch(
  () => props.open,
  isOpen => {
    if (!isOpen) {
      selectedPack.value = null;
      selectedAliases.value = new Set();
    }
  }
);

const currentPack = computed(() => {
  if (!selectedPack.value || !presets.value) return null;
  return presets.value.find(p => p.id === selectedPack.value);
});

const selectPack = (packId: string) => {
  selectedPack.value = packId;
  // Auto-select all aliases by default
  const pack = presets.value?.find(p => p.id === packId);
  if (pack) {
    selectedAliases.value = new Set(pack.aliases.map(a => a.name));
  }
};

const toggleAlias = (aliasName: string) => {
  const newSet = new Set(selectedAliases.value);
  if (newSet.has(aliasName)) {
    newSet.delete(aliasName);
  } else {
    newSet.add(aliasName);
  }
  selectedAliases.value = newSet;
};

const toggleAllAliases = () => {
  if (!currentPack.value) return;

  if (selectedAliases.value.size === currentPack.value.aliases.length) {
    // Unselect all
    selectedAliases.value = new Set();
  } else {
    // Select all
    selectedAliases.value = new Set(currentPack.value.aliases.map(a => a.name));
  }
};

const handleInstall = async () => {
  if (!selectedPack.value || selectedAliases.value.size === 0) return;

  try {
    await installMutation.mutateAsync({
      packId: selectedPack.value,
      aliasNames: Array.from(selectedAliases.value),
    });
    emit('installed');
  } catch (error) {
    console.error('Failed to install preset pack:', error);
  }
};

const handleClose = () => {
  emit('close');
};

// Category badge colors
const categoryColors: Record<string, string> = {
  git: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  docker: 'bg-blue-100 text-blue-800 border-blue-300',
  system: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};
</script>

<template>
  <Dialog :open="open" @update:open="val => !val && handleClose()">
    <DialogContent class="flex max-h-[80vh] max-w-4xl flex-col overflow-hidden">
      <DialogHeader>
        <DialogTitle>Install Preset Alias Packs</DialogTitle>
        <DialogDescription>
          Select a preset pack and choose which aliases to install. Popular shortcuts for common
          tools.
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Package class="text-muted-foreground h-6 w-6 animate-pulse" />
      </div>

      <div v-else class="flex flex-1 gap-4 overflow-hidden">
        <!-- Preset Packs List -->
        <div class="w-1/3 space-y-2 overflow-y-auto pr-2">
          <button
            v-for="pack in presets"
            :key="pack.id"
            @click="selectPack(pack.id)"
            class="hover:bg-accent w-full rounded-lg border p-4 text-left transition-colors"
            :class="{
              'border-primary bg-accent': selectedPack === pack.id,
            }"
          >
            <div class="flex items-start gap-3">
              <span class="text-2xl">{{ pack.icon }}</span>
              <div class="flex-1">
                <h3 class="font-semibold">{{ pack.name }}</h3>
                <p class="text-muted-foreground mt-1 text-sm">{{ pack.description }}</p>
                <div class="mt-2">
                  <Badge :class="categoryColors[pack.category]" class="text-xs">
                    {{ pack.category }}
                  </Badge>
                  <span class="text-muted-foreground ml-2 text-xs">
                    {{ pack.aliases.length }} aliases
                  </span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <!-- Alias Selection -->
        <div v-if="currentPack" class="flex flex-1 flex-col overflow-hidden border-l pl-4">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="font-semibold">Select Aliases</h3>
            <Button @click="toggleAllAliases" variant="outline" size="sm">
              {{
                selectedAliases.size === currentPack.aliases.length ? 'Deselect All' : 'Select All'
              }}
            </Button>
          </div>

          <div class="flex-1 space-y-2 overflow-y-auto pr-2">
            <div
              v-for="alias in currentPack.aliases"
              :key="alias.name"
              class="hover:bg-accent flex items-start gap-3 rounded-lg border p-3 transition-colors"
            >
              <Checkbox
                :checked="selectedAliases.has(alias.name)"
                @update:checked="() => toggleAlias(alias.name)"
                class="mt-0.5"
              />
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <code class="bg-muted rounded px-1.5 py-0.5 font-mono text-sm font-semibold">
                    {{ alias.name }}
                  </code>
                  <span class="text-muted-foreground text-sm">→</span>
                  <code class="text-muted-foreground rounded font-mono text-sm">
                    {{ alias.command }}
                  </code>
                </div>
                <p class="text-muted-foreground mt-1 text-sm">{{ alias.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="text-muted-foreground flex flex-1 flex-col items-center justify-center border-l pl-4"
        >
          <Package class="mb-2 h-12 w-12 opacity-50" />
          <p class="text-sm">Select a preset pack to view aliases</p>
        </div>
      </div>

      <!-- Error Message -->
      <div
        v-if="installMutation.isError.value"
        class="bg-danger-50 flex items-start gap-2 rounded-lg border border-red-200 p-3"
      >
        <AlertCircle class="text-danger-600 mt-0.5 h-5 w-5" />
        <div class="text-danger-800 text-sm">
          <p class="font-medium">Failed to install preset pack</p>
          <p class="mt-1">{{ installMutation.error.value?.message || 'Unknown error' }}</p>
        </div>
      </div>

      <!-- Success Message -->
      <div
        v-if="installMutation.isSuccess.value"
        class="border-success-200 bg-success-50 flex items-start gap-2 rounded-lg border p-3"
      >
        <Check class="text-success-600 mt-0.5 h-5 w-5" />
        <div class="text-success-800 text-sm">
          <p class="font-medium">Preset pack installed successfully!</p>
        </div>
      </div>

      <DialogFooter>
        <Button @click="handleClose" variant="outline">Cancel</Button>
        <Button
          @click="handleInstall"
          :disabled="!selectedPack || selectedAliases.size === 0 || installMutation.isPending.value"
        >
          <Package class="mr-2 h-4 w-4" />
          {{
            installMutation.isPending.value
              ? 'Installing...'
              : `Install ${selectedAliases.size} Aliases`
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
