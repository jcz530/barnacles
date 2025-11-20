<script setup lang="ts">
import { ref, computed } from 'vue';
import { ChevronDown, MapPin } from 'lucide-vue-next';
import type { ParsedExifData } from '../../../shared/utilities/exif-reader';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CopyButton from '@/components/atoms/CopyButton.vue';

const props = defineProps<{
  exifData: ParsedExifData | null;
}>();

const searchQuery = ref('');

const filteredCategories = computed(() => {
  if (!props.exifData) return [];
  if (!searchQuery.value) return props.exifData.categories;

  const query = searchQuery.value.toLowerCase();
  return props.exifData.categories
    .map(category => ({
      ...category,
      fields: category.fields.filter(
        field =>
          field.label.toLowerCase().includes(query) || field.value.toLowerCase().includes(query)
      ),
    }))
    .filter(category => category.fields.length > 0);
});

const totalFields = computed(() => {
  if (!props.exifData) return 0;
  return props.exifData.categories.reduce((total, category) => total + category.fields.length, 0);
});
</script>

<template>
  <div v-if="exifData" class="space-y-4">
    <!-- GPS Indicator -->
    <div v-if="exifData.hasGPS && exifData.gpsData" class="bg-primary/5 rounded-lg border p-4">
      <div class="flex items-start gap-3">
        <MapPin class="text-primary mt-0.5 h-5 w-5" />
        <div class="flex-1">
          <h3 class="mb-1 text-sm font-semibold">GPS Location Found</h3>
          <p class="text-muted-foreground text-sm">
            Latitude: {{ exifData.gpsData.latitude.toFixed(6) }}, Longitude:
            {{ exifData.gpsData.longitude.toFixed(6) }}
            <span v-if="exifData.gpsData.altitude">
              ({{ exifData.gpsData.altitude.toFixed(2) }}m)
            </span>
          </p>
        </div>
      </div>
    </div>

    <!-- Search and Summary -->
    <div class="space-y-3">
      <Input v-model="searchQuery" type="text" placeholder="Search EXIF data..." class="w-full" />
      <div class="text-muted-foreground flex items-center justify-between text-sm">
        <span>{{ totalFields }} metadata fields found</span>
        <span v-if="searchQuery">
          {{ filteredCategories.reduce((sum, cat) => sum + cat.fields.length, 0) }}
          matching
        </span>
      </div>
    </div>

    <!-- No Results -->
    <div
      v-if="filteredCategories.length === 0"
      class="bg-muted/50 rounded-lg border p-8 text-center"
    >
      <p class="text-muted-foreground">
        {{ searchQuery ? 'No matching fields found' : 'No EXIF data found' }}
      </p>
    </div>

    <!-- EXIF Categories -->
    <div v-else class="space-y-3">
      <Collapsible
        v-for="category in filteredCategories"
        :key="category.name"
        :default-open="true"
        class="bg-card rounded-lg border"
      >
        <CollapsibleTrigger
          class="hover:bg-muted/50 flex w-full items-center justify-between p-4 transition-colors"
        >
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">{{ category.name }}</h3>
            <Badge variant="secondary">{{ category.fields.length }}</Badge>
          </div>
          <ChevronDown class="ui-open:rotate-180 h-4 w-4 transition-transform" />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div class="border-t">
            <div
              v-for="(field, index) in category.fields"
              :key="field.key"
              :class="[
                'hover:bg-muted/30 flex items-start justify-between gap-4 p-4 transition-colors',
                index !== category.fields.length - 1 && 'border-b',
              ]"
            >
              <div class="min-w-0 flex-1">
                <p class="mb-1 text-sm font-medium">{{ field.label }}</p>
                <p class="text-muted-foreground text-sm break-words">
                  {{ field.value }}
                </p>
              </div>
              <CopyButton :value="field.value" size="icon" class="shrink-0" />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>

  <div v-else class="bg-muted/50 rounded-lg border p-12 text-center">
    <p class="text-muted-foreground">Upload an image to view its EXIF data</p>
  </div>
</template>
