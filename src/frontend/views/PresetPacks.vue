<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { useQueries } from '@/composables/useQueries';
import type { PresetPack } from '@/shared/types/api';
import { AlertCircle, ArrowLeft, Check, Package, Sparkles } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';

const { setBreadcrumbs } = useBreadcrumbs();
const { usePresetsQuery, useInstallPresetMutation } = useQueries();
const router = useRouter();

onMounted(() => {
  setBreadcrumbs([{ label: 'Aliases', href: '/aliases' }, { label: 'Preset Packs' }]);
});

const { data: presets, isLoading } = usePresetsQuery({ enabled: true });
const installMutation = useInstallPresetMutation();

const selectedPack = ref<string | null>(null);
const selectedAliases = ref<Set<string>>(new Set());

const currentPack = computed(() => {
  if (!selectedPack.value || !presets.value) return null;
  return presets.value.find(p => p.id === selectedPack.value);
});

const selectPack = (pack: PresetPack) => {
  selectedPack.value = pack.id;
  // Auto-select all aliases by default
  selectedAliases.value = new Set(pack.aliases.map(a => a.name));
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
    // Wait a bit for the mutation success handler to invalidate queries
    // Then redirect back to aliases page
    setTimeout(() => {
      router.push('/aliases');
    }, 1500);
  } catch (error) {
    console.error('Failed to install preset pack:', error);
  }
};

const goBack = () => {
  router.push('/aliases');
};

// Category badge colors
const categoryColors: Record<string, string> = {
  git: 'bg-green-100 text-green-800 border-green-300',
  docker: 'bg-blue-100 text-blue-800 border-blue-300',
  system: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <Button @click="goBack" variant="ghost" size="sm" class="mb-4">
          <ArrowLeft class="mr-2 h-4 w-4" />
          Back to Aliases
        </Button>
        <div class="flex items-center gap-3">
          <div class="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
            <Package class="text-primary h-6 w-6" />
          </div>
          <div>
            <h2 class="text-2xl font-semibold">Install Preset Alias Packs</h2>
            <p class="text-muted-foreground mt-1">
              Popular shortcuts for common tools. Select a pack and choose which aliases to install.
            </p>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <Package class="text-muted-foreground h-8 w-8 animate-pulse" />
      </div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Preset Packs Grid -->
        <div class="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Available Packs</CardTitle>
              <CardDescription>Choose a preset pack to get started</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <button
                v-for="pack in presets"
                :key="pack.id"
                @click="selectPack(pack)"
                class="hover:bg-accent w-full rounded-lg border p-4 text-left transition-colors"
                :class="{
                  'border-primary bg-accent ring-primary ring-2 ring-offset-2':
                    selectedPack === pack.id,
                }"
              >
                <div class="flex items-start gap-3">
                  <span class="text-3xl">{{ pack.icon }}</span>
                  <div class="flex-1">
                    <h3 class="font-semibold">{{ pack.name }}</h3>
                    <p class="text-muted-foreground mt-1 text-sm">{{ pack.description }}</p>
                    <div class="mt-3 flex items-center gap-2">
                      <Badge :class="categoryColors[pack.category]" class="text-xs">
                        {{ pack.category }}
                      </Badge>
                      <span class="text-muted-foreground text-xs">
                        {{ pack.aliases.length }} aliases
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        <!-- Alias Selection Panel -->
        <div class="lg:col-span-2">
          <Card v-if="currentPack">
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="flex items-center gap-2">
                    <span class="text-2xl">{{ currentPack.icon }}</span>
                    {{ currentPack.name }}
                  </CardTitle>
                  <CardDescription>
                    Select the aliases you want to install ({{ selectedAliases.size }} of
                    {{ currentPack.aliases.length }} selected)
                  </CardDescription>
                </div>
                <Button @click="toggleAllAliases" variant="outline" size="sm">
                  {{
                    selectedAliases.size === currentPack.aliases.length
                      ? 'Deselect All'
                      : 'Select All'
                  }}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-for="alias in currentPack.aliases"
                  :key="alias.name"
                  class="hover:bg-accent rounded-lg border p-4 transition-colors"
                  :class="{
                    'border-primary/50 bg-accent/50': selectedAliases.has(alias.name),
                  }"
                >
                  <Label class="flex cursor-pointer items-start gap-3">
                    <Checkbox
                      :model-value="selectedAliases.has(alias.name)"
                      @update:model-value="() => toggleAlias(alias.name)"
                      class="mt-1"
                    />
                    <div class="flex-1">
                      <div class="mb-2 flex flex-wrap items-center gap-2">
                        <code class="bg-muted rounded px-2 py-1 font-mono text-sm font-semibold">
                          {{ alias.name }}
                        </code>
                        <span class="text-muted-foreground text-sm">→</span>
                        <code class="text-muted-foreground rounded font-mono text-sm">
                          {{ alias.command }}
                        </code>
                      </div>
                      <p class="text-muted-foreground text-sm">{{ alias.description }}</p>
                    </div>
                  </Label>
                </div>
              </div>

              <!-- Info Message -->
              <div
                class="mt-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3"
              >
                <Sparkles class="mt-0.5 h-5 w-5 text-sky-600" />
                <div class="text-sm text-sky-800">
                  <p class="font-medium">Ready to install</p>
                  <p class="mt-1">
                    Selected aliases will be added to your terminal configuration. You'll need to
                    restart your terminal or source your profile to use them.
                  </p>
                </div>
              </div>

              <!-- Error Message -->
              <div
                v-if="installMutation.isError.value"
                class="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
              >
                <AlertCircle class="mt-0.5 h-5 w-5 text-red-600" />
                <div class="text-sm text-red-800">
                  <p class="font-medium">Failed to install preset pack</p>
                  <p class="mt-1">{{ installMutation.error.value?.message || 'Unknown error' }}</p>
                </div>
              </div>

              <!-- Success Message -->
              <div
                v-if="installMutation.isSuccess.value"
                class="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3"
              >
                <Check class="mt-0.5 h-5 w-5 text-green-600" />
                <div class="text-sm text-green-800">
                  <p class="font-medium">Preset pack installed successfully!</p>
                  <p class="mt-1">Redirecting to aliases page...</p>
                </div>
              </div>

              <!-- Install Button -->
              <div class="mt-6 flex justify-end gap-2">
                <Button @click="goBack" variant="outline">Cancel</Button>
                <Button
                  @click="handleInstall"
                  :disabled="selectedAliases.size === 0 || installMutation.isPending.value"
                >
                  <Package class="mr-2 h-4 w-4" />
                  {{
                    installMutation.isPending.value
                      ? 'Installing...'
                      : `Install ${selectedAliases.size} ${selectedAliases.size === 1 ? 'Alias' : 'Aliases'}`
                  }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Empty State -->
          <Card v-else>
            <CardContent
              class="text-muted-foreground flex flex-col items-center justify-center py-16"
            >
              <Package class="mb-4 h-16 w-16 opacity-50" />
              <p class="text-lg font-medium">Select a preset pack to get started</p>
              <p class="text-muted-foreground mt-2 text-sm">
                Choose from the available packs on the left
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>
