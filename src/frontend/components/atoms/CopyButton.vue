<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-vue-next';
import type { ButtonProps } from '@/components/ui/button';

interface CopyButtonProps {
  /** The text content to copy to clipboard */
  value: string;
  /** Optional label to show next to the icon */
  label?: string;
  /** Label to show when copied (only if label prop is provided) */
  copiedLabel?: string;
  /** Button variant */
  variant?: ButtonProps['variant'];
  /** Button size */
  size?: ButtonProps['size'];
  /** Additional CSS classes */
  class?: string;
  /** Icon size class (e.g., 'h-4 w-4') */
  iconSize?: string;
  /** Duration to show success state in milliseconds */
  timeout?: number;
  /** Optional title/tooltip text */
  title?: string;
}

const props = withDefaults(defineProps<CopyButtonProps>(), {
  variant: 'ghost',
  size: 'sm',
  iconSize: 'h-4 w-4',
  timeout: 2000,
  copiedLabel: 'Copied!',
});

const isCopied = ref(false);
const isAnimating = ref(false);

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.value);
    isAnimating.value = true;
    isCopied.value = true;

    // Reset animation state after animation completes
    setTimeout(() => {
      isAnimating.value = false;
    }, 300);

    // Reset copied state after timeout
    setTimeout(() => {
      isCopied.value = false;
    }, props.timeout);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}
</script>

<template>
  <Button
    :variant="variant"
    :size="size"
    :class="class"
    :title="title || (isCopied ? copiedLabel : 'Copy to clipboard')"
    @click="handleCopy"
  >
    <div class="copy-icon-container">
      <Check
        v-if="isCopied"
        :class="[iconSize, { 'icon-enter': isAnimating }]"
        class="copy-icon text-success-500"
      />
      <Copy
        v-else
        :class="[iconSize, { 'icon-exit': isAnimating && isCopied }]"
        class="copy-icon"
      />
    </div>
    <span v-if="label" :class="{ 'ml-2': true }">
      {{ isCopied ? copiedLabel : label }}
    </span>
  </Button>
</template>

<style scoped>
.copy-icon-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.copy-icon {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enter animation for Check icon */
.icon-enter {
  animation: iconEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Exit animation for Copy icon */
.icon-exit {
  animation: iconExit 0.2s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes iconEnter {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-90deg);
  }
  50% {
    transform: scale(1.1) rotate(0deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes iconExit {
  0% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  100% {
    opacity: 0;
    transform: scale(0.8) rotate(90deg);
  }
}

/* Hover effect */
.copy-icon:hover {
  transform: scale(1.05);
}
</style>
