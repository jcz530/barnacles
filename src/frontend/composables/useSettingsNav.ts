import { onBeforeUnmount, ref } from 'vue';

type NavigateHandler = (sectionId: string, settingKey?: string) => void;

/**
 * Carries a heading click from the settings sidebar to the settings page.
 *
 * The two sit on opposite sides of `DefaultLayout` -- the sidebar is a sibling
 * of the `<router-view>`, not an ancestor -- so there is no prop path between
 * them. Scrolling is the page's job (it owns the scroll container and the
 * scroll-spy), and choosing a section is the sidebar's, so the click has to
 * cross that gap somehow. A single module-level handler is the smallest thing
 * that does it, and mirrors `useCommandPaletteState`'s shared-ref approach.
 *
 * Only one settings page is ever mounted, so a single slot is enough; it is
 * cleared on unmount so a stale page can never receive a later click.
 */
let handler: NavigateHandler | null = null;

/**
 * The section currently in view, published by the page's scroll-spy and read by
 * the sidebar to highlight the matching heading. It travels the same way and for
 * the same reason as the click above, just in the opposite direction.
 */
const activeSectionId = ref<string | null>(null);

export function useSettingsNav() {
  /** Registered by the settings page. */
  function onNavigate(fn: NavigateHandler) {
    handler = fn;
    onBeforeUnmount(() => {
      if (handler === fn) handler = null;
    });
  }

  /** Called by the sidebar. */
  function navigate(sectionId: string, settingKey?: string) {
    handler?.(sectionId, settingKey);
  }

  return { onNavigate, navigate, activeSectionId };
}
