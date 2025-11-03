<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from '@/composables/useTheme';
import LogoMarkStatic from '@/assets/logo-mark.svg';

const props = withDefaults(
  defineProps<{
    width?: number;
    height?: number;
  }>(),
  {
    width: 32,
    height: 32,
  }
);

const { activeTheme } = useTheme();

// Use static logo for default theme, dynamic gradient for custom themes
// This is a weird way to write this, but I want it to fall back to the
// static logo if no theme is loaded for whatever reason
const isDefaultTheme = computed(() => !(activeTheme.value?.primaryColor !== '#00c2e5'));

// Generate a unique ID for this instance's gradient to avoid conflicts
const gradientId = computed(() => `logo-gradient-${Math.random().toString(36).substring(2, 9)}`);
console.log(activeTheme.value);
</script>

<template>
  <!-- Static logo for default theme -->
  <img
    v-if="isDefaultTheme"
    :src="LogoMarkStatic"
    alt="Logo"
    :style="{ width: `${width}px`, height: `${height}px` }"
  />

  <!-- Dynamic gradient logo for custom themes -->
  <svg
    v-else
    :width="width"
    :height="height"
    viewBox="0 0 1344 798"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M932.418 0.657104C978.068 -0.0550224 1020.2 25.0932 1041.24 65.6112L1329.91 621.53C1371.8 702.202 1312.69 798.44 1221.8 797.556L119.584 786.826C31.6365 785.97 -25.7937 694.232 11.8577 614.747L265.973 78.287C285.617 36.8166 327.111 10.1026 372.993 9.3866L932.418 0.657104ZM437.229 244C433.734 244 430.555 246.024 429.075 249.19L291.361 543.955C288.604 549.855 292.833 556.64 299.344 556.764L1033.25 570.71C1040.1 570.84 1044.58 563.573 1041.39 557.513L878.532 248.801C876.975 245.848 873.911 244 870.573 244H437.229Z"
      :fill="`url(#${gradientId})`"
    />
    <defs>
      <linearGradient
        :id="gradientId"
        x1="1115"
        y1="-39.5"
        x2="187.5"
        y2="631.5"
        gradientUnits="userSpaceOnUse"
      >
        <stop class="logo-gradient-start" />
        <stop offset="1" class="logo-gradient-end" />
      </linearGradient>
    </defs>
  </svg>
</template>

<style scoped>
.logo-gradient-start {
  stop-color: var(--color-primary-400);
}

.logo-gradient-end {
  stop-color: var(--color-secondary-400);
}
</style>
