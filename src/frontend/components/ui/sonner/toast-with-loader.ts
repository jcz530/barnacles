import { type ExternalToast, toast } from 'vue-sonner';
import { h } from 'vue';
import {
  ScanLoader,
  DotsLoader,
  type LoaderType,
  LogoLoader,
  PulseLoader,
  SpinnerLoader,
} from './loaders';

export const loaderComponents = {
  scan: ScanLoader,
  dots: DotsLoader,
  logo: LogoLoader,
  pulse: PulseLoader,
  spinner: SpinnerLoader,
};

interface LoadingToastOptions extends ExternalToast {
  loader?: LoaderType;
  loaderSize?: number;
}

/**
 * Creates a loading toast with a custom loader component
 * @param message - The message to display
 * @param options - Toast options including custom loader type
 * @returns Toast ID
 *
 * @example
 * ```ts
 * // Use default spinner loader
 * const id = toastLoading('Processing...');
 *
 * // Use dots loader
 * const id = toastLoading('Discovering projects...', {
 *   loader: 'dots',
 *   description: 'Scanning your system',
 * });
 *
 * // Use pulse loader with custom size
 * const id = toastLoading('Loading...', {
 *   loader: 'pulse',
 *   loaderSize: 20,
 * });
 * ```
 */
export function toastLoading(message: string, options: LoadingToastOptions = {}): string | number {
  const { loader = 'spinner', loaderSize, ...toastOptions } = options;

  const LoaderComponent = loaderComponents[loader];

  return toast(message, {
    ...toastOptions,
    icon: h(LoaderComponent, { size: loaderSize }),
  });
}

/**
 * Updates an existing loading toast with a new message and/or loader
 * @param id - The toast ID to update
 * @param message - The new message
 * @param options - Toast options including custom loader type
 *
 * @example
 * ```ts
 * const id = toastLoading('Starting...');
 * // Later...
 * updateLoadingToast(id, 'Still processing...', {
 *   loader: 'scan',
 *   description: '50% complete',
 * });
 * ```
 */
export function updateLoadingToast(
  id: string | number,
  message: string,
  options: LoadingToastOptions = {}
): void {
  const { loader = 'spinner', loaderSize, ...toastOptions } = options;

  const LoaderComponent = loaderComponents[loader];

  toast(message, {
    ...toastOptions,
    id,
    icon: h(LoaderComponent, { size: loaderSize }),
  });
}
