<script setup lang="ts">
import { computed, ref } from 'vue';

interface DataSegment {
  color: string;
  percentage: number;
  label?: string;
}

interface Props {
  data: DataSegment[];
  circleSize?: number;
  gap?: number;
  fullWidth?: boolean;
  totalDots?: number;
  fixedGap?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  circleSize: 8,
  gap: 4,
  fullWidth: false,
  totalDots: 100,
  fixedGap: false,
});

const hoveredLabel = ref<string | null>(null);

interface Circle {
  color: string;
  label?: string;
  percentage: number;
}

const circles = computed<Circle[]>(() => {
  const result: Circle[] = [];

  // Sort data by percentage descending to ensure larger segments are placed first
  const sortedData = [...props.data].sort((a, b) => b.percentage - a.percentage);

  if (sortedData.length === 0) {
    // No data, return empty circles
    for (let i = 0; i < props.totalDots; i++) {
      result.push({
        color: '#e2e8f0',
        label: 'Empty',
        percentage: 0,
      });
    }
    return result;
  }

  // Calculate dots for each segment, ensuring at least 1 per segment
  const dotCounts: number[] = [];
  let totalAssigned = 0;

  // First pass: calculate ideal dots for each segment (minimum 1)
  for (const segment of sortedData) {
    const idealDots = (segment.percentage / 100) * props.totalDots;
    const dots = Math.max(1, Math.round(idealDots));
    dotCounts.push(dots);
    totalAssigned += dots;
  }

  // Adjust if we've assigned more than totalDots by removing from largest segments
  while (totalAssigned > props.totalDots) {
    // Find the segment with the most dots (that has more than 1)
    let maxIndex = -1;
    let maxDots = 1;
    for (let i = 0; i < dotCounts.length; i++) {
      if (dotCounts[i] > maxDots) {
        maxDots = dotCounts[i];
        maxIndex = i;
      }
    }
    if (maxIndex === -1) break; // All segments have 1 dot, can't reduce further
    dotCounts[maxIndex]--;
    totalAssigned--;
  }

  // Create the circles array
  for (let i = 0; i < sortedData.length; i++) {
    const segment = sortedData[i];
    const count = dotCounts[i];

    for (let j = 0; j < count; j++) {
      result.push({
        color: segment.color,
        label: segment.label,
        percentage: segment.percentage,
      });
    }
  }

  // Only fill with empty circles if percentages truly don't add up to 100%
  // This should rarely happen with proper data
  while (result.length < props.totalDots) {
    result.push({
      color: '#e2e8f0', // slate-200
      label: 'Empty',
      percentage: 0,
    });
  }

  return result;
});

const columns = computed(() => {
  // Calculate the number of columns based on square root of totalDots
  return Math.ceil(Math.sqrt(props.totalDots));
});

const gridStyle = computed(() => {
  if (props.fullWidth && props.fixedGap) {
    // Fixed gap mode: use auto-fit with fixed size circles
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, ${props.circleSize}px)`,
      gap: `${props.gap}px`,
      width: '100%',
      justifyContent: 'center',
    };
  } else if (props.fullWidth) {
    // Flexible mode: circles scale to fill width
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
      gap: `${props.gap}px`,
      width: '100%',
    };
  }
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
    gap: `${props.gap}px`,
  };
});

const circleStyle = computed(() => {
  if (props.fullWidth && props.fixedGap) {
    // Fixed gap mode: use fixed size
    return {
      width: `${props.circleSize}px`,
      height: `${props.circleSize}px`,
    };
  } else if (props.fullWidth) {
    // Flexible mode: scale to fill
    return {
      width: '100%',
      aspectRatio: '1',
      maxWidth: `${props.circleSize * 2}px`,
      maxHeight: `${props.circleSize * 2}px`,
    };
  }
  return {
    width: `${props.circleSize}px`,
    height: `${props.circleSize}px`,
  };
});
</script>

<template>
  <div class="percentage-grid-chart-wrapper">
    <div :style="gridStyle" class="percentage-grid-chart">
      <div v-for="(circle, index) in circles" :key="index">
        <div
          :title="circle.label"
          class="cursor-default rounded-full opacity-90 transition-all duration-200"
          :class="{
            'z-10 scale-125': hoveredLabel && circle.label === hoveredLabel,
            'opacity-50': hoveredLabel && circle.label !== hoveredLabel,
          }"
          :style="{
            ...circleStyle,
            backgroundColor: circle.color,
          }"
        />
      </div>
    </div>

    <div v-if="$slots.legend" class="mt-4">
      <slot
        name="legend"
        :data="data"
        :hovered-label="hoveredLabel"
        :on-hover="(label: string | null) => (hoveredLabel = label)"
      />
    </div>
  </div>
</template>

<style scoped>
.percentage-grid-chart-wrapper {
  width: 100%;
}

.percentage-grid-chart {
  width: fit-content;
  margin: 0 auto;
}

.percentage-grid-chart.full-width {
  width: 100%;
}
</style>
