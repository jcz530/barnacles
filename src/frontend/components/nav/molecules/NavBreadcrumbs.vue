<script setup lang="ts">
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { BreadcrumbSymbol } from '@/composables/useBreadcrumbs';
import { inject } from 'vue';
import { RouteNames } from '@/router';

const context = inject(BreadcrumbSymbol);
const breadcrumbs = context?.breadcrumbs;
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList class="text-xs">
      <BreadcrumbItem class="hidden md:block">
        <BreadcrumbLink as-child>
          <RouterLink :to="{ name: RouteNames.Home }"> Dashboard </RouterLink>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <template v-for="(item, index) in breadcrumbs" :key="index">
        <BreadcrumbSeparator class="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbLink v-if="item.href" as-child>
            <RouterLink :to="item.href">
              {{ item.label }}
            </RouterLink>
          </BreadcrumbLink>
          <BreadcrumbPage v-else>
            {{ item.label }}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
