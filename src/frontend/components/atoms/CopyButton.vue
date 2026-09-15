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
    <!-- No `appear` on the Transition: Vue skips enter animations on the initial
         render, so the icon is still on mount and only animates once the user
         has actually clicked. -->
    <div class="icon-container">
      <Transition name="icon-swap" mode="out-in">
        <Check v-if="isCopied" key="check" :class="iconSize" class="check-icon text-success-500" />
        <Copy v-else key="copy" :class="iconSize" class="copy-icon" />
      </Transition>
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
}

/* Entering: the copy icon rotates in, the check overshoots in. `mode="out-in"`
   means the outgoing icon finishes leaving before these run. */
.icon-swap-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.icon-swap-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.copy-icon.icon-swap-enter-from {
  opacity: 0;
  transform: scale(0.5) rotate(-180deg);
}

.copy-icon.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.5) rotate(180deg);
}

.check-icon.icon-swap-enter-from {
  opacity: 0;
  transform: scale(0.3) rotate(-90deg);
}

.check-icon.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.3) rotate(90deg);
}

/* Still swap the icons, just without the spin/scale. */
@media (prefers-reduced-motion: reduce) {
  .icon-swap-enter-active,
  .icon-swap-leave-active {
    transition: none;
  }
}
</style>
