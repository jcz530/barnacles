<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { X } from 'lucide-vue-next';
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui';
import { cn } from '@/lib/utils';
import { useToastAwareDismiss } from '@/composables/useToastAwareDismiss';

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);

// A click or focus landing on a toast is not a click outside the dialog.
const { onInteractOutside, isEventFromToast } = useToastAwareDismiss();

/**
 * This variant scrolls inside its own overlay, so the overlay owns the
 * scrollbar. A pointerdown on that scrollbar reports coordinates past the
 * element's client box and would otherwise read as a click outside.
 */
function isEventOnScrollbar(event: PointerEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  return event.offsetX > target.clientWidth || event.offsetY > target.clientHeight;
}

function onPointerDownOutside(event: CustomEvent<{ originalEvent: PointerEvent }>): void {
  const originalEvent = event.detail.originalEvent;
  if (isEventFromToast(originalEvent) || isEventOnScrollbar(originalEvent)) {
    event.preventDefault();
  }
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80"
    >
      <DialogContent
        :class="
          cn(
            'border-border bg-card relative z-50 my-8 grid w-full max-w-lg gap-4 border p-6 shadow-lg duration-200 sm:rounded-lg md:w-full',
            props.class
          )
        "
        v-bind="forwarded"
        @focus-outside="onInteractOutside"
        @pointer-down-outside="onPointerDownOutside"
      >
        <slot />

        <DialogClose
          class="hover:bg-secondary absolute top-4 right-4 rounded-md p-0.5 transition-colors"
        >
          <X class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
