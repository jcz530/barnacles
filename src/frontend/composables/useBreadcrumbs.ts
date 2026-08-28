import {
  inject,
  isRef,
  onUnmounted,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type Ref,
  type WatchStopHandle,
} from 'vue';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export type BreadcrumbSource =
  BreadcrumbItem[] | Ref<BreadcrumbItem[]> | ComputedRef<BreadcrumbItem[]>;

/** Identifies which component instance last wrote the breadcrumbs. */
type BreadcrumbOwner = number;

interface BreadcrumbContext {
  breadcrumbs: Ref<BreadcrumbItem[]>;
  /** The instance whose breadcrumbs are currently displayed. */
  currentOwner: Ref<BreadcrumbOwner | null>;
  setBreadcrumbs: (items: BreadcrumbSource, owner: BreadcrumbOwner) => void;
}

export const BreadcrumbSymbol: InjectionKey<BreadcrumbContext> = Symbol('breadcrumbs');

let nextOwner = 0;

/**
 * Provides breadcrumb context in a layout component
 */
export function provideBreadcrumbs() {
  const breadcrumbs = ref<BreadcrumbItem[]>([]);
  const currentOwner = ref<BreadcrumbOwner | null>(null);

  // Only one reactive source may drive the breadcrumbs at a time. This watcher
  // is registered in the layout's scope, which outlives every page, so it has
  // to be stopped by hand when a new source takes over — otherwise a stale
  // page's computed keeps firing and overwrites the current page's crumbs.
  let stopWatching: WatchStopHandle | null = null;

  const setBreadcrumbs = (items: BreadcrumbSource, owner: BreadcrumbOwner) => {
    stopWatching?.();
    stopWatching = null;
    currentOwner.value = owner;

    if (isRef(items)) {
      breadcrumbs.value = items.value;
      stopWatching = watch(items, newItems => {
        breadcrumbs.value = newItems;
      });
    } else {
      breadcrumbs.value = items;
    }
  };

  provide(BreadcrumbSymbol, { breadcrumbs, currentOwner, setBreadcrumbs });

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

  const { currentOwner, setBreadcrumbs } = context;
  const owner = ++nextOwner;

  onUnmounted(() => {
    // Vue mounts the incoming page before unmounting the outgoing one, so by
    // the time this runs the next page has usually already set its own crumbs.
    // Only clear what this instance still owns, or we'd wipe them.
    if (currentOwner.value === owner) {
      setBreadcrumbs([], owner);
      currentOwner.value = null;
    }
  });

  return {
    setBreadcrumbs: (items: BreadcrumbSource) => setBreadcrumbs(items, owner),
  };
}
