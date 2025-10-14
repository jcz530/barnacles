import { type ExternalToast, toast } from 'vue-sonner';
import { h } from 'vue';
import { type LoaderType } from './loaders';
import { loaderComponents } from './toast-with-loader';

export type ToastVariant = 'default' | 'info' | 'success' | 'danger';

interface VariantToastOptions extends ExternalToast {
  variant?: ToastVariant;
  loader?: LoaderType;
  loaderSize?: number;
}

/**
 * Creates a toast with a specific variant (styling)
 * @param message - The message to display
 * @param options - Toast options including variant and optional loader
 * @returns Toast ID
 *
 * @example
 * ```ts
 * // Success toast
 * toastWithVariant('Operation completed!', { variant: 'success' });
 *
 * // Info toast with custom loader
 * toastWithVariant('Processing...', {
 *   variant: 'info',
 *   loader: 'dots',
 *   duration: Infinity,
 * });
 *
 * // Danger toast
 * toastWithVariant('Error occurred', { variant: 'danger' });
 * ```
 */
export function toastWithVariant(
  message: string,
  options: VariantToastOptions = {}
): string | number {
  const { variant = 'default', loader, loaderSize, ...toastOptions } = options;

  // Map variant to toast type for vue-sonner's built-in styling
  const typeMap: Record<ToastVariant, 'success' | 'error' | 'info' | undefined> = {
    default: undefined,
    info: 'info',
    success: 'success',
    danger: 'error',
  };

  const toastType = typeMap[variant];

  // If loader is specified, use it; otherwise use default icon for the type
  const icon = loader ? h(loaderComponents[loader], { size: loaderSize }) : undefined;

  // Use the appropriate toast function based on type
  if (toastType === 'success') {
    return toast.success(message, {
      ...toastOptions,
      ...(icon && { icon }),
    });
  } else if (toastType === 'error') {
    return toast.error(message, {
      ...toastOptions,
      ...(icon && { icon }),
    });
  } else if (toastType === 'info') {
    return toast.info(message, {
      ...toastOptions,
      ...(icon && { icon }),
    });
  } else {
    return toast(message, {
      ...toastOptions,
      ...(icon && { icon }),
    });
  }
}

/**
 * Creates a loading toast with a specific variant
 * @param message - The message to display
 * @param options - Toast options including variant and loader
 * @returns Toast ID
 *
 * @example
 * ```ts
 * // Info loading toast
 * const id = toastLoadingWithVariant('Discovering projects...', {
 *   variant: 'info',
 *   loader: 'dots',
 *   description: 'Scanning your system',
 * });
 * ```
 */
export function toastLoadingWithVariant(
  message: string,
  options: VariantToastOptions = {}
): string | number {
  const { loader = 'spinner', ...rest } = options;
  return toastWithVariant(message, {
    ...rest,
    loader,
    duration: options.duration ?? Infinity,
  });
}

/**
 * Convenience function for success toasts
 * @example
 * ```ts
 * toastSuccess('Operation completed!', { description: 'All items processed' });
 * ```
 */
export function toastSuccess(message: string, options: ExternalToast = {}): string | number {
  return toast.success(message, options);
}

/**
 * Convenience function for info toasts
 * @example
 * ```ts
 * toastInfo('New update available', { description: 'Click to learn more' });
 * ```
 */
export function toastInfo(message: string, options: ExternalToast = {}): string | number {
  return toast.info(message, options);
}

/**
 * Convenience function for danger/error toasts
 * @example
 * ```ts
 * toastDanger('Operation failed', { description: 'Please try again' });
 * ```
 */
export function toastDanger(message: string, options: ExternalToast = {}): string | number {
  return toast.error(message, options);
}

/**
 * Convenience function for default toasts
 * @example
 * ```ts
 * toastDefault('Something happened', { description: 'Just FYI' });
 * ```
 */
export function toastDefault(message: string, options: ExternalToast = {}): string | number {
  return toast(message, options);
}
