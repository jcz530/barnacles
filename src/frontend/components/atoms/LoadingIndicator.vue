<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'pulse' | 'draw' | 'shimmer' | 'glow';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'draw',
});

const sizeClasses = computed(() => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };
  return sizes[props.size];
});

const animationClass = computed(() => {
  const animations = {
    pulse: 'animate-loading-pulse',
    draw: 'animate-loading-draw',
    shimmer: 'animate-loading-shimmer',
    glow: 'animate-loading-glow',
  };
  return animations[props.variant];
});

const isPathAnimation = computed(() => {
  return ['draw', 'shimmer', 'glow'].includes(props.variant);
});
</script>

<template>
  <div class="flex items-center justify-center">
    <div :class="[sizeClasses, 'relative']">
      <svg
        v-if="isPathAnimation"
        :class="animationClass"
        viewBox="-50 -50 1444 898"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="h-full w-full"
        style="overflow: visible"
      >
        <defs>
          <linearGradient
            id="paint0_linear"
            x1="1115"
            y1="-39.5"
            x2="187.5"
            y2="631.5"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stop-color="#02DDFF" />
            <stop offset="1" stop-color="#DC8CBC" />
          </linearGradient>
          <linearGradient id="shimmer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#02DDFF" stop-opacity="0" />
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#DC8CBC" stop-opacity="0" />
          </linearGradient>
          <filter id="glow-filter">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          class="logo-path"
          d="M932.418 0.657104C978.068 -0.0550224 1020.2 25.0932 1041.24 65.6112L1329.91 621.53C1371.8 702.202 1312.69 798.44 1221.8 797.556L119.584 786.826C31.6365 785.97 -25.7937 694.232 11.8577 614.747L265.973 78.287C285.617 36.8166 327.111 10.1026 372.993 9.3866L932.418 0.657104ZM437.229 244C433.734 244 430.555 246.024 429.075 249.19L291.361 543.955C288.604 549.855 292.833 556.64 299.344 556.764L1033.25 570.71C1040.1 570.84 1044.58 563.573 1041.39 557.513L878.532 248.801C876.975 245.848 873.911 244 870.573 244H437.229Z"
          :fill="variant === 'glow' ? 'url(#paint0_linear)' : 'none'"
          :stroke="variant === 'draw' ? 'url(#paint0_linear)' : 'none'"
          :filter="variant === 'glow' ? 'url(#glow-filter)' : undefined"
          stroke-width="64"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          v-if="variant === 'shimmer'"
          class="logo-path-shimmer"
          d="M932.418 0.657104C978.068 -0.0550224 1020.2 25.0932 1041.24 65.6112L1329.91 621.53C1371.8 702.202 1312.69 798.44 1221.8 797.556L119.584 786.826C31.6365 785.97 -25.7937 694.232 11.8577 614.747L265.973 78.287C285.617 36.8166 327.111 10.1026 372.993 9.3866L932.418 0.657104ZM437.229 244C433.734 244 430.555 246.024 429.075 249.19L291.361 543.955C288.604 549.855 292.833 556.64 299.344 556.764L1033.25 570.71C1040.1 570.84 1044.58 563.573 1041.39 557.513L878.532 248.801C876.975 245.848 873.911 244 870.573 244H437.229Z"
          fill="url(#paint0_linear)"
        />
      </svg>
      <img
        v-else
        src="@/assets/logo-mark.svg"
        alt="Loading"
        :class="[animationClass, 'h-full w-full object-contain']"
      />
    </div>
  </div>
</template>

<style scoped>
/* Path-based animations */
.logo-path {
  stroke-dasharray: 6000;
  stroke-dashoffset: 6000;
}

.animate-loading-draw .logo-path {
  animation: draw-path 3s ease-in-out infinite;
}

@keyframes draw-path {
  0% {
    stroke-dashoffset: 6000;
    opacity: 0.3;
  }
  50% {
    stroke-dashoffset: 0;
    opacity: 1;
  }
  100% {
    stroke-dashoffset: -6000;
    opacity: 0.3;
  }
}

/* Shimmer effect */
.logo-path-shimmer {
  opacity: 0.2;
}

.animate-loading-shimmer .logo-path-shimmer {
  animation: shimmer-fill 2s ease-in-out infinite;
}

.animate-loading-shimmer {
  animation: shimmer-sweep 2s ease-in-out infinite;
}

@keyframes shimmer-fill {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}

@keyframes shimmer-sweep {
  0% {
    filter: brightness(1) contrast(1);
  }
  50% {
    filter: brightness(1.3) contrast(1.1);
  }
  100% {
    filter: brightness(1) contrast(1);
  }
}

/* Glow pulse effect */
.animate-loading-glow .logo-path {
  animation: glow-pulse 2s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.6;
    filter: drop-shadow(0 0 8px #02ddff) drop-shadow(0 0 16px #dc8cbc);
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 16px #02ddff) drop-shadow(0 0 32px #dc8cbc);
  }
}

/* Legacy animations for image fallback */
@keyframes loading-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.95);
  }
}

.animate-loading-pulse {
  animation: loading-pulse 2s ease-in-out infinite;
}
</style>
