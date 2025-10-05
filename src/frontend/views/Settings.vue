<script setup lang="ts">
import { useBreadcrumbs } from '@/composables/useBreadcrumbs';
import { onMounted, ref, computed, watch } from 'vue';
import { useQueries } from '../composables/useQueries';
import Card from '../components/ui/card/Card.vue';
import CardHeader from '../components/ui/card/CardHeader.vue';
import CardTitle from '../components/ui/card/CardTitle.vue';
import CardDescription from '../components/ui/card/CardDescription.vue';
import CardContent from '../components/ui/card/CardContent.vue';
import Input from '../components/ui/input/Input.vue';
import Button from '../components/ui/button/Button.vue';

const { setBreadcrumbs } = useBreadcrumbs();

onMounted(() => {
  setBreadcrumbs([{ label: 'Settings' }]);
});

const { useSettingsQuery, useUpdateSettingMutation } = useQueries();

const settingsQuery = useSettingsQuery({ enabled: true });
const updateSettingMutation = useUpdateSettingMutation();

// Default values
const DEFAULT_SCAN_MAX_DEPTH = 3;

// Local state for form inputs
const scanMaxDepth = ref(DEFAULT_SCAN_MAX_DEPTH);
const isInitialized = ref(false);

// Update local state when settings are loaded
watch(
  () => settingsQuery.data.value,
  newData => {
    if (newData) {
      const maxDepthSetting = newData.find(s => s.key === 'scanMaxDepth');
      if (maxDepthSetting) {
        scanMaxDepth.value = Number(maxDepthSetting.value);
      }
      isInitialized.value = true;
    }
  },
  { immediate: true }
);

// Auto-save when value changes (after initialization)
watch(scanMaxDepth, async newValue => {
  if (isInitialized.value && !updateSettingMutation.isPending.value) {
    await updateSettingMutation.mutateAsync({
      key: 'scanMaxDepth',
      value: newValue,
      type: 'number',
    });
  }
});

const resetToDefault = async () => {
  scanMaxDepth.value = DEFAULT_SCAN_MAX_DEPTH;
};

const isDefaultValue = computed(() => scanMaxDepth.value === DEFAULT_SCAN_MAX_DEPTH);
const isSaving = computed(() => updateSettingMutation.isPending.value);
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Settings</h2>
        <p class="text-muted-foreground mt-1">Manage your application preferences</p>
      </div>

      <div class="space-y-6">
        <!-- Project Scanning Settings -->
        <Card>
          <CardHeader>
            <CardTitle>Project Scanning</CardTitle>
            <CardDescription>Configure how projects are discovered and scanned</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <div class="flex flex-col gap-2">
                <label for="scanMaxDepth" class="text-sm font-medium"> Scan Maximum Depth </label>
                <p class="text-muted-foreground text-sm">
                  Maximum directory depth to scan when searching for projects. Increase this value
                  if your projects are nested deeper in subdirectories.
                </p>
                <div class="flex items-center gap-4">
                  <Input
                    id="scanMaxDepth"
                    v-model.number="scanMaxDepth"
                    type="number"
                    min="1"
                    max="10"
                    :class="['w-32', isDefaultValue ? 'text-muted-foreground' : '']"
                  />
                  <Button
                    @click="resetToDefault"
                    variant="outline"
                    size="sm"
                    :disabled="isDefaultValue || isSaving"
                    class="flex items-center gap-2"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Reset to Default
                  </Button>
                  <span v-if="isSaving" class="text-muted-foreground text-sm">Saving...</span>
                </div>
                <p class="text-muted-foreground text-xs">
                  Default: {{ DEFAULT_SCAN_MAX_DEPTH }} • Current: {{ scanMaxDepth }} (Projects
                  nested up to {{ scanMaxDepth }} levels deep will be found)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </div>
</template>

<style scoped></style>
