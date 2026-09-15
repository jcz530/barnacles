<script setup lang="ts">
import { computed } from 'vue';

/**
 * The play / stop / loading glyph for the start-process button.
 *
 * One `<path>` whose `d` is transitioned rather than three swapped icons, so
 * the triangle genuinely deforms into the square instead of cross-fading. CSS
 * only interpolates `d` when both paths share the same command sequence, so all
 * three shapes are authored as `M` + five `L` + `Z` — six points each, walked in
 * the same direction from the same corner. The square and triangle carry
 * doubled/collinear points to reach six; they read as a plain square and
 * triangle, but they tween cleanly against the hexagon.
 *
 * Stroke attributes mirror lucide's defaults (24x24, fill none, currentColor,
 * width 2, round caps/joins) so this sits correctly beside the chevron and
 * inherits the button variant's colour.
 */
export type ProcessIconState = 'play' | 'stop' | 'loading';

const props = withDefaults(defineProps<{ state?: ProcessIconState }>(), {
  state: 'play',
});

/**
 * Six-corner paths, each starting mid-way along an edge and running clockwise
 * so corresponding points travel the shortest distance.
 *
 * Every corner is `L` (run to where the corner starts) + `A` (arc across it),
 * so each shape is `M` followed by that pair six times. The sequence has to
 * match across all three or the browser cuts between shapes instead of
 * tweening them.
 *
 * The radius is small on purpose — just enough to take the point off each
 * corner, matching the lucide icons these replaced. The triangle's and
 * square's mid-edge points carry the same arc, which is invisible on a
 * straight run but keeps the command count even.
 *
 * Generated from the vertices rather than hand-authored: each corner is cut
 * back by the radius along both adjoining edges, which guarantees the arcs
 * stay feasible (chord never exceeds 2r) instead of being silently rescaled.
 */
const SHAPES: Record<ProcessIconState, string> = {
  // Triangle pointing right, apex on the centreline.
  play: 'M7.34 4.4 L13.18 7.8 A0 0 0 0 1 13.18 7.8 L19.02 11.2 A1.6 1.6 0 0 1 19.02 12.8 L13.18 16.2 A0 0 0 0 1 13.18 16.2 L7.34 19.6 A1.6 1.6 0 0 1 5.95 18.8 L5.95 12 A0 0 0 0 1 5.95 12 L5.95 5.2 A1.6 1.6 0 0 1 7.34 4.4 Z',
  // Square.
  stop: 'M6.38 4.78 L12 4.78 A0 0 0 0 1 12 4.78 L17.62 4.78 A1.6 1.6 0 0 1 19.22 6.38 L19.22 17.62 A1.6 1.6 0 0 1 17.62 19.22 L12 19.22 A0 0 0 0 1 12 19.22 L6.38 19.22 A1.6 1.6 0 0 1 4.78 17.62 L4.78 6.38 A1.6 1.6 0 0 1 6.38 4.78 Z',
  // Regular hexagon, flat-top.
  loading:
    'M13.39 4.4 L17.89 7 A1.6 1.6 0 0 1 19.27 9.4 L19.27 14.6 A1.6 1.6 0 0 1 17.89 17 L13.39 19.6 A1.6 1.6 0 0 1 10.61 19.6 L6.11 17 A1.6 1.6 0 0 1 4.73 14.6 L4.73 9.4 A1.6 1.6 0 0 1 6.11 7 L10.61 4.4 A1.6 1.6 0 0 1 13.39 4.4 Z',
};

const shape = computed(() => SHAPES[props.state]);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="process-state-icon"
    :class="{ 'is-spinning': state === 'loading' }"
    aria-hidden="true"
  >
    <path :d="shape" />
  </svg>
</template>

<style scoped>
.process-state-icon path {
  transition: d 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Spin the whole glyph, not the path, so the morph and the rotation compose. */
.process-state-icon.is-spinning {
  animation: process-icon-spin 1.1s linear infinite;
  transform-origin: 50% 50%;
}

@keyframes process-icon-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Shapes still change, just without the tween or the spin.
 *
 * Split the same way as CopyButton: the media query for the OS preference, the
 * root class for the in-app setting, which can override it either way. */
@media (prefers-reduced-motion: reduce) {
  :root:not(.no-reduce-motion) .process-state-icon path {
    transition: none;
  }

  :root:not(.no-reduce-motion) .process-state-icon.is-spinning {
    animation: none;
  }
}

:root.reduce-motion .process-state-icon path {
  transition: none;
}

:root.reduce-motion .process-state-icon.is-spinning {
  animation: none;
}
</style>
