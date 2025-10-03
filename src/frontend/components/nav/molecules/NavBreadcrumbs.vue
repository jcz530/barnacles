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

const context = inject(BreadcrumbSymbol);
const breadcrumbs = context?.breadcrumbs;
</script>

<template>
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem class="hidden md:block">
        <BreadcrumbLink as-child>
          <RouterLink to="/"> Dashboard </RouterLink>
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
