<script setup lang="ts">
import { ref } from 'vue';
import type { ButtonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-vue-next';

interface CopyButtonProps {
  /** The text content to copy to clipboard */
  value: string;
  /** Optional label to show next to the icon */
  label?: string;
  /** Label to show when copied (only if label prop is provided) */
  copiedLabel?: string;
  /** Button variant */
  variant?: ButtonVariants['variant'];
  /** Button size */
  size?: ButtonVariants['size'];
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

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.value);
    isCopied.value = true;

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
    :class="[{ 'bg-success-400/20 hover:bg-success-400/20': isCopied }]"
    :title="title || (isCopied ? copiedLabel : 'Copy to clipboard')"
    @click="handleCopy"
  >
    <div class="icon-container">
      <Copy :class="[iconSize, { hidden: isCopied, visible: !isCopied }]" class="copy-icon" />
      <Check
        :class="[iconSize, { hidden: !isCopied, visible: isCopied }]"
        class="check-icon text-success-500"
      />
    </div>
    <span v-if="label" :class="{ 'ml-2': true }">
      {{ isCopied ? copiedLabel : label }}
    </span>
  </Button>
</template>

<style scoped>
.icon-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1rem;
  min-height: 1rem;
}

.copy-icon,
.check-icon {
  position: absolute;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.copy-icon.visible {
  animation: fadeInRotate 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.copy-icon.hidden {
  animation: fadeOutRotate 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.check-icon.visible {
  animation: fadeInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.check-icon.hidden {
  animation: fadeOutScale 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
}

@keyframes fadeInRotate {
  from {
    opacity: 0;
    transform: scale(0.5) rotate(-180deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes fadeOutRotate {
  from {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  to {
    opacity: 0;
    transform: scale(0.5) rotate(180deg);
  }
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-90deg);
  }
  60% {
    transform: scale(1.15) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

@keyframes fadeOutScale {
  from {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
  to {
    opacity: 0;
    transform: scale(0.3) rotate(90deg);
  }
}
</style>
