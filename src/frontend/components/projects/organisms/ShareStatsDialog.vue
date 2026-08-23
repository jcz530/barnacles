<script setup lang="ts">
import type { Component } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import {
  Copy,
  Download,
  Image as ImageIcon,
  RectangleHorizontal,
  Square,
  Type,
} from 'lucide-vue-next';
import type { GitStats, ProjectWithDetails } from '@shared/types/api';
import {
  buildShareModel,
  STAT_LABELS,
  TEMPLATE_STATS,
  type Granularity,
  type ShareSize,
  type ShareStatKey,
  type ShareTemplate,
} from '@shared/share/share-model';
import { renderShareText, renderShareTextCompact } from '@shared/share/share-text';
import {
  DESIGN_META,
  DESIGNS,
  resolveDesign,
  SIZES,
  statCapacity,
  type ShareDesign,
} from '../../../utils/share-card';
import { useShareCard } from '../../../composables/useShareCard';
import ShareCardPreview from '../molecules/ShareCardPreview.vue';
import SegmentedControl from '../../ui/atoms/SegmentedControl.vue';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Switch } from '../../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

const props = defineProps<{
  stats?: GitStats;
  periodLabel: string;
  granularity: Granularity;
  selectedProjects: string[];
  allProjects: ProjectWithDetails[];
}>();

const open = defineModel<boolean>('open', { required: true });

const { isBusy, buildHtml, copyImage, saveImage, copyText } = useShareCard();

// Remembered across sessions: both are set-once preferences rather than
// per-share decisions.
const anonymizeProjects = useLocalStorage('share-stats:anonymize', false);
const size = useLocalStorage<ShareSize>('share-stats:size', 'og');
const storedDesign = useLocalStorage<string>('share-stats:design', 'poster');

/**
 * Normalized on read: these designs were renamed after shipping, so a returning
 * user has the old name stored. Writing through the same ref migrates it.
 */
const design = computed<ShareDesign>({
  get: () => resolveDesign(storedDesign.value),
  set: value => {
    storedDesign.value = value;
  },
});

const template = ref<ShareTemplate>('recap');
const statKeys = ref<ShareStatKey[]>([...TEMPLATE_STATS.recap]);
type TextVariant = 'full' | 'compact';
const textVariant = ref<TextVariant>('full');

const TEXT_OPTIONS: Array<{ value: TextVariant; label: string }> = [
  { value: 'full', label: 'Full' },
  { value: 'compact', label: 'Compact' },
];

const TEMPLATE_OPTIONS: Array<{ value: Exclude<ShareTemplate, 'custom'>; label: string }> = [
  { value: 'recap', label: 'Recap' },
  { value: 'streak', label: 'Streak' },
  { value: 'breakdown', label: 'Breakdown' },
];

/** Icons mirror each output's proportions; the shape is clearer than the pixels. */
const SIZE_OPTIONS: Array<{ value: ShareSize; label: string; icon: Component }> = [
  { value: 'og', label: SIZES.og.shortLabel, icon: RectangleHorizontal },
  { value: 'square', label: SIZES.square.shortLabel, icon: Square },
];

const DESIGN_OPTIONS: Array<{ value: ShareDesign; label: string; icon: Component }> = DESIGNS.map(
  value => ({ value, ...DESIGN_META[value] })
);

/** Every stat the picker offers, in card order. */
const PICKABLE: ShareStatKey[] = [
  'commits',
  'streak',
  'activeDays',
  'avgPerActiveDay',
  'linesAdded',
  'linesRemoved',
  'netLines',
  'filesChanged',
  'projects',
  'churn',
  'busiestDay',
];

function applyTemplate(next: Exclude<ShareTemplate, 'custom'>) {
  template.value = next;
  statKeys.value = [...TEMPLATE_STATS[next]];
}

/**
 * Toggling a stat individually turns the selection into a custom one — the
 * template buttons are presets for this list, not a separate mode.
 */
function toggleStat(key: ShareStatKey, checked: boolean) {
  const next = checked ? [...statKeys.value, key] : statKeys.value.filter(k => k !== key);
  statKeys.value = next;
  template.value = 'custom';
}

/**
 * How many stats the chosen design fits at the chosen size.
 *
 * Varies by both — the poster layout holds one fewer on the short card — so
 * the picker's cap has to move with them rather than being a single number.
 */
const capacity = computed(() => statCapacity(design.value, size.value));

/**
 * The selection is never trimmed when capacity shrinks.
 *
 * Switching design or size would otherwise silently discard stats the user
 * picked, making a flip back and forth lossy. Instead the extras are held here
 * and named in the hint below, so nothing disappears without being said.
 */
const visibleStatKeys = computed(() => statKeys.value.slice(0, capacity.value));
const hiddenStats = computed(() => statKeys.value.slice(capacity.value));

const atCap = computed(() => statKeys.value.length >= capacity.value);
const isSelected = (key: ShareStatKey) => statKeys.value.includes(key);

function build(keys: ShareStatKey[]) {
  if (!props.stats) return null;
  return buildShareModel(
    props.stats,
    {
      template: template.value,
      statKeys: keys,
      anonymizeProjects: anonymizeProjects.value,
      size: size.value,
    },
    {
      periodLabel: props.periodLabel,
      granularity: props.granularity,
      selectedProjects: props.selectedProjects,
      allProjects: props.allProjects,
    }
  );
}

/** What the card draws — clamped to the chosen layout's capacity. */
const model = computed(() => build(visibleStatKeys.value));

/**
 * The text summary takes the whole selection.
 *
 * Only the card is bound by a layout, so capping the text as well would drop a
 * stat from the summary for a reason that does not apply to it.
 */
const textModel = computed(() => build(statKeys.value));

const summary = computed(() => {
  if (!textModel.value) return '';
  return textVariant.value === 'compact'
    ? renderShareTextCompact(textModel.value)
    : renderShareText(textModel.value);
});

// Resolved into a ref rather than computed directly: the theme snapshot has to
// wait for the dialog to be in the DOM, which computeds cannot do.
const previewHtml = ref('');

/**
 * `design` is watched explicitly.
 *
 * `model` does not depend on it — a design is purely presentational — so on a
 * size where both designs hold the same number of stats, toggling would leave
 * `model` referentially identical and the preview stale.
 */
watch(
  [model, design, size, open],
  async () => {
    if (!open.value || !model.value) {
      previewHtml.value = '';
      return;
    }

    // Wait for the dialog to actually be in the DOM before snapshotting the
    // theme: getComputedStyle on an unmounted tree returns empty custom
    // properties, which renders the chart with no colours at all.
    await nextTick();
    previewHtml.value = buildHtml(model.value, size.value, design.value);
  },
  { immediate: true }
);
</script>

<template>
  <Dialog v-model:open="open">
    <!-- Capped to the viewport with the middle scrolling: the square card is
         tall enough to run off the bottom of a laptop screen, which would
         otherwise put the action buttons out of reach. -->
    <DialogContent class="flex max-h-[90vh] flex-col sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Share your stats</DialogTitle>
        <DialogDescription>
          Build a card from this period's stats, or copy it as text.
        </DialogDescription>
      </DialogHeader>

      <Tabs default-value="image" class="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList>
          <TabsTrigger value="image">
            <ImageIcon class="size-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="text">
            <Type class="size-4" />
            Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="image" class="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <ShareCardPreview v-if="previewHtml" :html="previewHtml" :size="size" />

          <!-- Split in two: what the card looks like on top, what goes on it
               below, directly above the stat picker it drives. Three controls
               on one row wrap at this dialog width. -->
          <div class="flex flex-wrap items-center gap-2">
            <SegmentedControl v-model="design" :options="DESIGN_OPTIONS" />
            <SegmentedControl v-model="size" :options="SIZE_OPTIONS" class="ml-auto" />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <SegmentedControl
              :model-value="template"
              :options="TEMPLATE_OPTIONS"
              @update:model-value="applyTemplate"
            />
            <span v-if="template === 'custom'" class="text-xs text-slate-500">Custom</span>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label
              v-for="key in PICKABLE"
              :key="key"
              class="flex items-center gap-2 text-sm"
              :class="
                !isSelected(key) && atCap ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
              "
            >
              <Checkbox
                :model-value="isSelected(key)"
                :disabled="!isSelected(key) && atCap"
                @update:model-value="value => toggleStat(key, value === true)"
              />
              {{ STAT_LABELS[key] }}
            </label>
          </div>
          <p
            v-if="hiddenStats.length"
            class="text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            {{ DESIGN_META[design].label }} fits {{ capacity }} stats at this size —
            {{ hiddenStats.map(key => STAT_LABELS[key]).join(', ') }} not shown.
          </p>
          <p v-else-if="atCap" class="text-xs text-slate-500">
            Showing the most this card fits. Clear one to add another.
          </p>
        </TabsContent>

        <TabsContent value="text" class="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <pre
            class="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs whitespace-pre text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >{{ summary }}</pre>

          <div class="flex items-center gap-2">
            <SegmentedControl v-model="textVariant" :options="TEXT_OPTIONS" />
            <span class="ml-auto text-xs text-slate-500">{{ summary.length }} characters</span>
          </div>
        </TabsContent>
      </Tabs>

      <div class="flex shrink-0 flex-wrap items-center gap-3 border-t pt-4">
        <label class="flex items-center gap-2 text-sm">
          <Switch v-model="anonymizeProjects" />
          Hide project names
        </label>

        <div class="ml-auto flex items-center gap-2">
          <Button variant="ghost" :disabled="!model" @click="copyText(summary)">
            <Copy class="size-4" />
            Copy text
          </Button>
          <Button
            variant="outline"
            :disabled="!model || isBusy"
            @click="model && saveImage(model, size, design)"
          >
            <Download class="size-4" />
            Save PNG…
          </Button>
          <Button :disabled="!model || isBusy" @click="model && copyImage(model, size, design)">
            <Copy class="size-4" />
            {{ isBusy ? 'Working…' : 'Copy image' }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
