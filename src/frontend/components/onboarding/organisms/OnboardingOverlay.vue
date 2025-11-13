<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useOnboarding } from '../../../composables/useOnboarding';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../ui/card';
import { Label } from '../../ui/label';
import Button from '../../ui/button/Button.vue';
import DirectorySelectionList from '../molecules/DirectorySelectionList.vue';
import FolderAutocompleteInput from '../../molecules/FolderAutocompleteInput.vue';
import { Loader2, Plus } from 'lucide-vue-next';
import LogoMark from '@/components/nav/atoms/LogoMark.vue';

// Accept startScan function from parent to ensure we use the same WebSocket instance
const props = defineProps<{
  startScan: (options?: { directories?: string[] }) => void;
}>();

const { useDiscoverDirectoriesQuery, useStartScanMutation } = useOnboarding(props.startScan);

// Fetch discovered directories
const discoverQuery = useDiscoverDirectoriesQuery({ enabled: true });

// Local state
const selectedDirectories = ref<string[]>([]);
const customDirectory = ref('');
const showCustomInput = ref(false);

// Initialize selected directories when discovered directories are loaded
watch(
  () => discoverQuery.data.value,
  directories => {
    if (directories && directories.length > 0) {
      // Auto-select all discovered directories
      selectedDirectories.value = directories.map(d => d.path);
    }
  },
  { immediate: true }
);

const startScanMutation = useStartScanMutation();

const allDirectories = computed(() => {
  const discovered = discoverQuery.data.value?.map(d => d.path) || [];
  return [...new Set([...discovered, ...customDirectories.value])];
});

const customDirectories = ref<string[]>([]);

const addCustomDirectory = () => {
  const trimmed = customDirectory.value.trim();
  if (trimmed && !customDirectories.value.includes(trimmed)) {
    customDirectories.value.push(trimmed);
    selectedDirectories.value.push(trimmed);
    customDirectory.value = '';
    showCustomInput.value = false;
  }
};

const handleStartScanning = () => {
  if (selectedDirectories.value.length === 0) {
    return;
  }

  startScanMutation.mutate({
    directories: selectedDirectories.value,
  });
};

const isLoading = computed(
  () => discoverQuery.isLoading.value || startScanMutation.isPending.value
);

const hasNoDirectories = computed(
  () => !discoverQuery.isLoading.value && allDirectories.value.length === 0
);
</script>

<template>
  <Card class="mx-auto w-full max-w-3xl border-none bg-transparent pt-0 shadow-none">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="bg-primary/10 flex size-12 items-center justify-center rounded-lg">
          <LogoMark />
        </div>
        <div>
          <CardTitle class="text-xl">Welcome to Barnacles!</CardTitle>
          <CardDescription>Let's find your projects</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <p class="text-muted-foreground text-sm">
        We need to know where to find your development projects on your computer. Add any parent
        directories you want us to look in. We'll include all projects we find in there (you don't
        need to add individual project folders).
      </p>
      <p class="text-muted-foreground text-sm">
        If we don't find all your projects right away, don't worry — you can add more directories
        later and increase the scan depth.
      </p>

      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <Loader2 class="text-muted-foreground size-8 animate-spin" />
      </div>

      <!-- Empty state -->
      <div v-else-if="hasNoDirectories">
        <div
          class="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-slate-300 py-12"
        >
          <p class="text-lg">Where do you keep your projects?</p>
          <p class="text-muted-foreground text-center text-sm">
            None of our default directories were found on your system.
            <br />
            Add a custom directory to get started.
          </p>
        </div>
      </div>

      <div v-else class="flex flex-col gap-1">
        <Label>Where do you keep your projects?</Label>
        <!-- Directory selection list -->
        <DirectorySelectionList
          class="d-block"
          v-model="selectedDirectories"
          :directories="allDirectories"
        />
      </div>

      <!-- Add custom directory section -->
      <div class="space-y-2 border-t pt-4">
        <Button
          v-if="!showCustomInput"
          variant="outline"
          size="sm"
          class="w-full"
          @click="showCustomInput = true"
          :disabled="isLoading"
        >
          <Plus :size="16" class="mr-2" />
          Add Custom Directory
        </Button>

        <div v-else class="flex items-center gap-2">
          <FolderAutocompleteInput
            v-model="customDirectory"
            placeholder="Enter directory path (e.g., ~/MyProjects)..."
            class="flex-1"
            :max-depth="3"
            @keydown.enter="addCustomDirectory"
            :strict="false"
          />
          <Button @click="addCustomDirectory" size="sm" :disabled="!customDirectory.trim()">
            Add
          </Button>
          <Button @click="showCustomInput = false" size="sm" variant="ghost">Cancel</Button>
        </div>
      </div>

      <p class="text-muted-foreground text-xs">
        {{
          selectedDirectories.length === 0
            ? 'No directories selected'
            : `${selectedDirectories.length} ${selectedDirectories.length === 1 ? 'directory' : 'directories'} selected`
        }}
      </p>
    </CardContent>

    <CardFooter class="flex justify-between">
      <Button
        @click="handleStartScanning"
        :disabled="selectedDirectories.length === 0 || isLoading"
      >
        <Loader2 v-if="startScanMutation.isPending.value" class="mr-2 size-4 animate-spin" />
        Start Scanning
      </Button>
    </CardFooter>
  </Card>
</template>
