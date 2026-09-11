<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue';
import { API_ROUTES, RUNTIME_CONFIG } from '../../../../shared/constants';

/**
 * The real app icon for an IDE or terminal, falling back to a glyph.
 *
 * Only macOS serves these, and only for tools that ship an .app bundle -- vim
 * and emacs never will. `fallback` is therefore the normal rendering for a
 * large share of rows, not an error path, so it takes the caller's own glyph
 * rather than a generic one.
 */
const props = defineProps<{
  toolId: string;
  toolName: string;
  kind: 'ide' | 'terminal';
  /** Whether the backend found a bundle. Skips a request that would 404. */
  hasAppIcon?: boolean;
  /**
   * Drawn when there is no app icon. A component for the palette, which wants
   * its own glyph; `color` instead for the dropdowns, which showed a swatch
   * before this and should keep doing so where no icon resolves.
   */
  fallback?: Component;
  /** Brand colour, drawn as a swatch when `fallback` is not given. */
  color?: string;
  size?: 'sm' | 'md';
}>();

// Tracks load failures separately from `hasAppIcon` so a broken response falls
// back without contradicting what the backend reported.
const failed = ref(false);

// A row can be recycled onto a different tool as the palette filters, and a
// stale failure would suppress the new tool's perfectly good icon.
watch(
  () => props.toolId,
  () => {
    failed.value = false;
  }
);

const iconUrl = computed(() => {
  if (!props.hasAppIcon || failed.value) return null;
  const route =
    props.kind === 'ide'
      ? API_ROUTES.PROJECTS_IDE_ICON(props.toolId)
      : API_ROUTES.PROJECTS_TERMINAL_ICON(props.toolId);
  return `${RUNTIME_CONFIG.API_BASE_URL}${route}`;
});

const sizeClasses = computed(() => (props.size === 'md' ? 'size-5' : 'size-4'));
</script>

<template>
  <img
    v-if="iconUrl"
    :src="iconUrl"
    :alt="`${toolName} icon`"
    :class="[sizeClasses, 'shrink-0 object-contain']"
    @error="failed = true"
  />
  <component v-else-if="fallback" :is="fallback" :class="[sizeClasses, 'shrink-0']" />
  <!--
    The swatch this replaced. A raw hex is allowed here because it is the
    vendor's own brand colour carried as data, not theme styling.

    Boxed to the icon's own size, with the smaller swatch centred inside it: a
    list mixing apps that have icons with CLI-only tools that do not would
    otherwise wrap its labels at two different offsets.
  -->
  <span v-else-if="color" :class="[sizeClasses, 'flex shrink-0 items-center justify-center']">
    <span class="h-3 w-3 rounded-sm" :style="{ backgroundColor: color }" />
  </span>
</template>
