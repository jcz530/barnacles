import { ref } from 'vue';
import type { ShareModel, ShareSize } from '@shared/share/share-model';
import { renderShareCardHtml, SIZES, snapshotTheme, type ShareDesign } from '../utils/share-card';
import { toastDanger, toastSuccess } from '../components/ui/sonner';

/**
 * Turns a `ShareModel` into a PNG and gets it to the clipboard or disk.
 *
 * The card markup is generated here in the renderer, where the live theme
 * lives; the main process only rasterizes whatever HTML it is handed.
 */

/** `barnacles-march-2025.png` */
function suggestedFileName(model: ShareModel): string {
  const slug = model.periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `barnacles-${slug || 'stats'}.png`;
}

export function useShareCard() {
  const isBusy = ref(false);

  /**
   * The exact document that gets rasterized — also used for the preview.
   *
   * The theme is snapshotted here, from the live DOM, so a customized app
   * produces a customized card.
   */
  function buildHtml(model: ShareModel, size: ShareSize, design: ShareDesign): string {
    return renderShareCardHtml(model, snapshotTheme(), size, design);
  }

  async function renderPng(
    model: ShareModel,
    size: ShareSize,
    design: ShareDesign
  ): Promise<Uint8Array | null> {
    const { width, height } = SIZES[size];
    const result = await window.electron.shareCard.render({
      html: buildHtml(model, size, design),
      width,
      height,
      outputWidth: width,
      outputHeight: height,
    });

    if (!result.success || !result.data) {
      toastDanger('Could not create the image', { description: result.error });
      return null;
    }
    return result.data.png;
  }

  async function copyImage(model: ShareModel, size: ShareSize, design: ShareDesign): Promise<void> {
    if (isBusy.value) return;
    isBusy.value = true;
    try {
      const png = await renderPng(model, size, design);
      if (!png) return;

      const written = await window.electron.clipboard.writeImage(png);
      if (written.success) {
        toastSuccess('Image copied', { description: 'Paste it straight into a post' });
      } else {
        toastDanger('Could not copy the image', { description: written.error });
      }
    } finally {
      isBusy.value = false;
    }
  }

  async function saveImage(model: ShareModel, size: ShareSize, design: ShareDesign): Promise<void> {
    if (isBusy.value) return;
    isBusy.value = true;
    try {
      const png = await renderPng(model, size, design);
      if (!png) return;

      const saved = await window.electron.shareCard.save({
        png,
        suggestedName: suggestedFileName(model),
      });

      if (saved.canceled) return;
      if (!saved.success || !saved.data) {
        toastDanger('Could not save the image', { description: saved.error });
        return;
      }

      const filePath = saved.data;
      toastSuccess('Image saved', {
        description: filePath,
        action: {
          label: 'Show in folder',
          onClick: () => void window.electron.shell.showItemInFolder(filePath),
        },
      });
    } finally {
      isBusy.value = false;
    }
  }

  async function copyText(text: string): Promise<void> {
    const written = await window.electron.clipboard.writeText(text);
    if (written.success) {
      toastSuccess('Summary copied');
    } else {
      toastDanger('Could not copy the summary', { description: written.error });
    }
  }

  return { isBusy, buildHtml, copyImage, saveImage, copyText, suggestedFileName };
}
