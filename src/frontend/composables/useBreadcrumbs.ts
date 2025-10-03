import { inject, onUnmounted, provide, ref, type InjectionKey, type Ref } from 'vue';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbContext {
  breadcrumbs: Ref<BreadcrumbItem[]>;
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
}

export const BreadcrumbSymbol: InjectionKey<BreadcrumbContext> = Symbol('breadcrumbs');

/**
 * Provides breadcrumb context in a layout component
 */
export function provideBreadcrumbs() {
  const breadcrumbs = ref<BreadcrumbItem[]>([]);

  const setBreadcrumbs = (items: BreadcrumbItem[]) => {
    breadcrumbs.value = items;
  };

  provide(BreadcrumbSymbol, { breadcrumbs, setBreadcrumbs });

  return { breadcrumbs };
}

/**
 * Consumes breadcrumb context in a page component
 */
export function useBreadcrumbs() {
  const context = inject(BreadcrumbSymbol);

  if (!context) {
    throw new Error('useBreadcrumbs must be used within a component that provides breadcrumbs');
  }

  const { setBreadcrumbs } = context;

  // Clear breadcrumbs on unmount to prevent stale data
  onUnmounted(() => {
    setBreadcrumbs([]);
  });

  return { setBreadcrumbs };
}
