<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg';
}>();
</script>

<template>
  <span
    class="flame-icon"
    :class="{
      'flame-sm': size === 'sm' || !size,
      'flame-md': size === 'md',
      'flame-lg': size === 'lg',
    }"
    aria-label="Killing process"
    role="img"
  >
    <svg viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg" class="flame-svg">
      <!-- Outer flame -->
      <path
        class="flicker-outer"
        d="M12 2
           C12 2, 18 8, 18 14
           C18 17, 16.5 19.5, 14.5 21
           C15 19, 14.5 17, 13 16
           C13.5 18.5, 12 21, 10 22.5
           C7.5 20.5, 6 17.5, 6 14
           C6 8, 12 2, 12 2Z"
        fill="url(#grad-outer)"
      />
      <!-- Mid flame -->
      <path
        class="flicker-mid"
        d="M12 7
           C12 7, 16 11.5, 16 15
           C16 17.5, 14.5 19.5, 12.5 20.5
           C13 18.5, 12.5 17, 11 16
           C11.5 18, 10.5 20, 9 21
           C7.5 19.5, 8 17, 8 15
           C8 11.5, 12 7, 12 7Z"
        fill="url(#grad-mid)"
      />
      <!-- Inner core -->
      <path
        class="flicker-inner"
        d="M12 12
           C12 12, 14 14.5, 14 16.5
           C14 18.5, 13 20, 12 21
           C11 20, 10 18.5, 10 16.5
           C10 14.5, 12 12, 12 12Z"
        fill="url(#grad-inner)"
      />
      <defs>
        <linearGradient
          id="grad-outer"
          x1="12"
          y1="2"
          x2="12"
          y2="22.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#fed7aa" />
          <stop offset="50%" stop-color="#fb923c" />
          <stop offset="100%" stop-color="#ea580c" />
        </linearGradient>
        <linearGradient id="grad-mid" x1="12" y1="7" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="50%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#f59e0b" />
        </linearGradient>
        <linearGradient
          id="grad-inner"
          x1="12"
          y1="12"
          x2="12"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="50%" stop-color="#fef9c3" />
          <stop offset="100%" stop-color="#fde047" />
        </linearGradient>
      </defs>
    </svg>
  </span>
</template>

<style scoped>
.flame-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.flame-sm {
  width: 16px;
  height: 16px;
}

.flame-md {
  width: 20px;
  height: 20px;
}

.flame-lg {
  width: 24px;
  height: 24px;
}

.flame-svg {
  width: 100%;
  height: 100%;
  transform-origin: bottom center;
}

.flicker-outer {
  animation: flicker-outer 0.55s ease-in-out infinite alternate;
  transform-origin: 12px 22px;
}

.flicker-mid {
  animation: flicker-mid 0.45s ease-in-out infinite alternate;
  animation-delay: 0.1s;
  transform-origin: 12px 21px;
}

.flicker-inner {
  animation: flicker-inner 0.35s ease-in-out infinite alternate;
  animation-delay: 0.05s;
  transform-origin: 12px 21px;
}

@keyframes flicker-outer {
  0% {
    transform: scaleX(1) scaleY(1) rotate(-1deg);
    filter: brightness(1);
  }
  25% {
    transform: scaleX(0.93) scaleY(1.04) rotate(1.5deg);
    filter: brightness(1.1);
  }
  50% {
    transform: scaleX(1.05) scaleY(0.97) rotate(-2deg);
    filter: brightness(0.95);
  }
  75% {
    transform: scaleX(0.97) scaleY(1.06) rotate(1deg);
    filter: brightness(1.08);
  }
  100% {
    transform: scaleX(1.02) scaleY(1) rotate(-0.5deg);
    filter: brightness(1);
  }
}

@keyframes flicker-mid {
  0% {
    transform: scaleX(1) scaleY(1) rotate(1deg);
    filter: brightness(1);
  }
  33% {
    transform: scaleX(1.06) scaleY(0.95) rotate(-1.5deg);
    filter: brightness(1.12);
  }
  66% {
    transform: scaleX(0.94) scaleY(1.05) rotate(2deg);
    filter: brightness(0.97);
  }
  100% {
    transform: scaleX(1.02) scaleY(0.98) rotate(-0.5deg);
    filter: brightness(1.05);
  }
}

@keyframes flicker-inner {
  0% {
    transform: scaleX(1) scaleY(1) rotate(-0.5deg);
    filter: brightness(1);
  }
  50% {
    transform: scaleX(1.08) scaleY(0.94) rotate(1deg);
    filter: brightness(1.15);
  }
  100% {
    transform: scaleX(0.95) scaleY(1.06) rotate(-1deg);
    filter: brightness(1.05);
  }
}
</style>
