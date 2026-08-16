<script setup lang="ts">
import type { Component } from 'vue';
import type { SidebarMenuButtonProps } from './SidebarMenuButtonChild.vue';
import { reactiveOmit } from '@vueuse/core';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SidebarMenuButtonChild from './SidebarMenuButtonChild.vue';
import { useSidebar } from './utils';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<
    SidebarMenuButtonProps & {
      tooltip?: string | Component;
    }
  >(),
  {
    as: 'button',
    variant: 'default',
    size: 'default',
  }
);

const { isMobile, state } = useSidebar();

const delegatedProps = reactiveOmit(props, 'tooltip');
</script>

<template>
  <!--
    The `as any` casts below work around a shadcn-vue/reka-ui typing quirk:
    `withDefaults(..., { as: 'button' })` in SidebarMenuButtonChild narrows the
    `as` prop to the string literal type, so spreading our wider
    `AsTag | Component` prop into it fails to type-check. Runtime is correct.
  -->
  <SidebarMenuButtonChild v-if="!tooltip" v-bind="{ ...delegatedProps, ...$attrs } as any">
    <slot />
  </SidebarMenuButtonChild>

  <Tooltip v-else>
    <TooltipTrigger as-child>
      <SidebarMenuButtonChild v-bind="{ ...delegatedProps, ...$attrs } as any">
        <slot />
      </SidebarMenuButtonChild>
    </TooltipTrigger>
    <TooltipContent side="right" align="center" :hidden="state !== 'collapsed' || isMobile">
      <template v-if="typeof tooltip === 'string'">
        {{ tooltip }}
      </template>
      <component :is="tooltip" v-else />
    </TooltipContent>
  </Tooltip>
</template>
