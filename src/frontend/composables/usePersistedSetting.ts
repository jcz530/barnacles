import { ref, watch, type Ref } from 'vue';
import type { Setting } from '@shared/types/api';

/**
 * A setting bound to a local ref that writes itself back when the user changes
 * it -- and, crucially, not when it is first filled in from the server.
 *
 * Every settings component used to hand-roll this with an `isInitialized` flag
 * set in the same tick as the hydrating assignment. Vue's watchers default to
 * `flush: 'pre'`, so the write-back watcher ran *after* that flag was already
 * true and happily PUT the value the server had just sent. A page load fired
 * one redundant PUT per setting; for the command palette shortcut that also
 * tore down and re-registered a global OS hotkey.
 *
 * The flag is replaced here by comparing against the last value known to be
 * persisted. That is not merely a more reliable guard -- it is a stronger one,
 * because it also drops writes when the user picks the value that is already
 * stored (reselecting the current entry in a dropdown, toggling a switch twice).
 */
export interface PersistedSettingOptions<T, S = Setting[]> {
  /**
   * Pull this setting's value out of a settings payload. Return `undefined`
   * when the payload has no row for it, so the caller's initial value stands.
   */
  read: (data: S) => T | undefined;
  /** Persist a user-made change. */
  write: (value: T) => Promise<unknown>;
  /** The value to hold until the server's arrives. */
  initial: T;
  /**
   * Compare a candidate against the last persisted value. Defaults to
   * `Object.is`; pass a structural comparison for arrays and objects.
   */
  equals?: (a: T, b: T) => boolean;
  /**
   * Reject values that should never be persisted (a half-typed number, an
   * empty required list). Rejected values stay in the ref -- the field keeps
   * showing what the user typed -- but are not written and do not advance the
   * persisted baseline.
   */
  isValid?: (value: T) => boolean;
  /** Run on every hydration, including the first. */
  onHydrate?: (value: T) => void;
  /** Handle a failed write. Without one, the rejection propagates. */
  onError?: (error: unknown, value: T) => void;
}

export interface PersistedSetting<T> {
  /** Bind this to the input. Assigning to it persists the change. */
  value: Ref<T>;
  /** True once a settings payload has been applied. */
  isHydrated: Ref<boolean>;
  /**
   * True once the payload actually contained a row for this setting.
   *
   * Distinct from `isHydrated`, which only says a payload arrived. A caller
   * that seeds from backend defaults must gate on *this*: a payload with no row
   * for the setting leaves the value unknown, and seeding is still the right
   * thing to do when the defaults land afterwards.
   */
  hasStoredValue: Ref<boolean>;
  /** The last value known to be on the server. */
  lastPersisted: Ref<T>;
}

/**
 * Shallow copy, so `lastPersisted` never aliases the live `value`.
 *
 * Only arrays need it: every other setting here is a primitive, which cannot be
 * mutated in place.
 */
function copy<T>(value: T): T {
  return (Array.isArray(value) ? [...value] : value) as T;
}

/**
 * @param source Getter for the settings query payload. Called reactively, so
 *   pass `() => query.data.value` rather than the unwrapped data.
 */
export function usePersistedSetting<T, S = Setting[]>(
  source: () => S | undefined,
  options: PersistedSettingOptions<T, S>
): PersistedSetting<T> {
  const { read, write, initial, equals = Object.is, isValid, onHydrate, onError } = options;

  const value = ref(initial) as Ref<T>;
  const lastPersisted = ref(copy(initial)) as Ref<T>;
  const isHydrated = ref(false);
  const hasStoredValue = ref(false);
  /** Writes currently in flight, so a racing refetch can be ignored. */
  let pendingWrites = 0;

  watch(
    source,
    data => {
      if (data === undefined || data === null) return;

      /*
       * A payload that is still in flight must not clobber an edit the user has
       * already made. The settings query refetches on window focus and on
       * remount, and the update mutation deliberately does not invalidate it,
       * so a refetch started before the edit can land after it carrying the old
       * value -- which would snap the control back while the PUT it is racing
       * succeeds, leaving the screen disagreeing with the database.
       */
      if (pendingWrites > 0) return;

      const stored = read(data);
      if (stored !== undefined) {
        value.value = stored;
        /*
         * Copied, not aliased. Assigning the same array to both refs would make
         * `equals(next, lastPersisted.value)` compare a mutated array against
         * itself, so an in-place `push`/`splice` -- exactly what `deep: true`
         * below exists to catch -- would compare equal and be dropped.
         */
        lastPersisted.value = copy(stored);

        // Set before the write-back watcher flushes, so the assignment above
        // is recognised as server state rather than a user edit.
        hasStoredValue.value = true;
      }

      isHydrated.value = true;
      onHydrate?.(value.value);
    },
    { immediate: true }
  );

  watch(
    value,
    async next => {
      if (!isHydrated.value) return;
      if (equals(next, lastPersisted.value)) return;
      if (isValid && !isValid(next)) return;

      // Advance the baseline before awaiting. A second edit landing mid-flight
      // would otherwise compare against the stale value and re-send this one.
      const previous = lastPersisted.value;
      const attempted = copy(next);
      lastPersisted.value = attempted;

      pendingWrites += 1;
      try {
        await write(next);
      } catch (error) {
        /*
         * The write failed, so the server still holds the old value. Roll the
         * baseline back, or a later retry of the same value would be seen as
         * "already persisted" and silently skipped.
         *
         * Only when this is still the most recent write: writes can settle out
         * of order, and restoring `previous` on top of a newer write that
         * already succeeded would leave the baseline behind both the UI and the
         * server, producing exactly the redundant PUT this composable exists to
         * prevent.
         */
        if (equals(lastPersisted.value, attempted)) {
          lastPersisted.value = previous;
        }

        if (!onError) throw error;
        onError(error, next);
      } finally {
        pendingWrites -= 1;
      }
    },
    { deep: true }
  );

  return { value, isHydrated, hasStoredValue, lastPersisted };
}

/** Structural comparison for the array-valued settings. Order-sensitive. */
export function arrayEquals<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => item === b[i]);
}
