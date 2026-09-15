<script setup lang="ts">
/*
 * One setting's label, description and control.
 *
 * Before this existed each setting wrote its own label, in three different
 * styles -- a shadcn `Label`, a raw `<label class="text-sm font-medium">`, and
 * in one case a bare `<span>`. They rendered at nearly the same weight as the
 * section heading above them, so a page of fourteen settings read as one flat
 * list with nothing for the eye to catch on. Routing every setting through here
 * is what makes the hierarchy (section heading > setting label > description)
 * hold on every row.
 */
withDefaults(
  defineProps<{
    label: string;
    description?: string;
    /**
     * 'inline' puts the control opposite the label, for a switch or a small
     * control that reads as an answer to the label. 'stacked' puts it beneath,
     * for inputs and lists that need the full width.
     */
    layout?: 'inline' | 'stacked';
    /** Set when the control is a real form element, to wire up the label. */
    labelFor?: string;
  }>(),
  { layout: 'stacked' }
);
</script>

<template>
  <div :class="layout === 'inline' ? 'flex items-center justify-between gap-4' : 'flex flex-col'">
    <div :class="['space-y-1', layout === 'inline' ? 'min-w-0' : '']">
      <!--
        The label carries an id so a non-labelable control can point back at it
        with aria-labelledby. `for` alone is not enough here: reka-ui renders a
        Switch as a <button role="switch">, and `for` only associates with
        labelable elements, so the name would depend on browser leniency.
      -->
      <component
        :is="labelFor ? 'label' : 'div'"
        :id="labelFor ? `${labelFor}-label` : undefined"
        :for="labelFor"
        class="text-foreground block text-sm leading-none font-medium"
      >
        <!-- Slot so a row can set a badge beside its name and still inherit the
             label's type treatment rather than re-styling it. -->
        <slot name="label">{{ label }}</slot>
      </component>
      <p
        v-if="description || $slots.description"
        class="text-muted-foreground text-xs leading-snug"
      >
        <slot name="description">{{ description }}</slot>
      </p>
    </div>

    <!-- shrink-0 so a switch is never squeezed by a long description beside it.
         Omitted entirely when there is no control, so a heading-only row (the
         theme picker renders its own body below) adds no stray spacing. -->
    <div v-if="$slots.default" :class="layout === 'inline' ? 'shrink-0' : 'mt-3'">
      <slot />
    </div>
  </div>
</template>
