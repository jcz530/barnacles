<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui';
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { Check, Minus } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

const props = defineProps<CheckboxRootProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<CheckboxRootEmits>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <CheckboxRoot
    data-slot="checkbox"
    v-bind="forwarded"
    :class="
      cn(
        'peer data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border border-slate-300 outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:text-slate-50 data-[state=indeterminate]:text-slate-50 dark:border-slate-600',
        props.class
      )
    "
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none"
    >
      <!-- The glyph carries an explicit text- class rather than inheriting from
           the root: menu/combobox items style descendant svgs with
           `[&_svg:not([class*='text-'])]:text-muted-foreground`, which is applied
           directly and so beats an inherited color. Naming a color here also
           opts out of that :not() selector entirely. -->
      <slot>
        <Minus v-if="props.modelValue === 'indeterminate'" class="size-3.5 text-current" />
        <Check v-else class="size-3.5 text-current" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
