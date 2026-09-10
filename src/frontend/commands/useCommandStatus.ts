import { readonly, ref } from 'vue';
import type { CommandStatus, CommandStatusKind } from './types';

/** How long a message stays up. Matches the toasts this replaces. */
export const STATUS_TIMEOUT_MS = 3000;

/**
 * How much copied text a message will quote before shortening it.
 *
 * The status line is one row in a 640px window, so a project path can easily
 * outrun it. The line truncates in CSS regardless; this keeps the *end* of the
 * value, which for a path or URL is the part that identifies it -- CSS would
 * keep the front and cut exactly that off.
 */
export const STATUS_VALUE_MAX = 48;

/** Shorten a copied value for quoting, keeping its tail. */
export const truncateValue = (value: string, max = STATUS_VALUE_MAX): string =>
  value.length <= max ? value : `…${value.slice(-(max - 1))}`;

/**
 * The palette's "what just happened" line.
 *
 * Held apart from useLevelStack on purpose. The stack is about where you are;
 * this is about what you last did, and the two have different lifetimes -- a
 * message has to outlive the level that raised it. Killing a port from inside
 * that port's own actions collapses the level (its subject is gone), and
 * clearing on that would wipe the confirmation in the one case it matters most.
 * See palette-refresh.test.ts, which pins that collapse.
 *
 * Kept out of the .vue file so it can be tested at all: the renderer's test
 * environment has no DOM.
 */
export const useCommandStatus = () => {
  const status = ref<CommandStatus | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let nextId = 0;

  const clearTimer = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
  };

  const clear = () => {
    clearTimer();
    status.value = null;
  };

  /**
   * Report an outcome, replacing whatever was showing.
   *
   * The timer restarts rather than accumulating, so running several commands in
   * a row leaves the last message up for its full dwell rather than having it
   * cut short by the first one's expiry.
   */
  const report = (message: string, kind: CommandStatusKind = 'success') => {
    clearTimer();
    status.value = { id: (nextId += 1), message, kind };
    timer = setTimeout(() => {
      status.value = null;
      timer = undefined;
    }, STATUS_TIMEOUT_MS);
  };

  return { status: readonly(status), report, clear };
};
