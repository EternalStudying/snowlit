import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let instant = false;

/**
 * Instant mode skips choreography entirely: animations jump to their end state. The test setup turns it on
 * so production code never has to ask whether it runs under the test runner.
 */
export function setInstantMotion(value: boolean) {
  instant = value;
}

export function isInstantMotion() {
  return instant;
}

/** The viewer's reduced-motion preference right now. */
export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

/** Reduced motion or instant mode: either way, nothing should animate. */
export function shouldSkipMotion() {
  return instant || prefersReducedMotion();
}

/**
 * The reduced-motion preference as a ref that follows the system setting while the component is mounted.
 * `onChange` runs after each change.
 */
export function useReducedMotion(onChange?: (reduced: boolean) => void): Ref<boolean> {
  const reduced = ref(prefersReducedMotion());
  let query: MediaQueryList | undefined;
  const sync = () => {
    reduced.value = Boolean(query?.matches);
    onChange?.(reduced.value);
  };

  onMounted(() => {
    query = window.matchMedia?.(REDUCED_MOTION_QUERY);
    reduced.value = Boolean(query?.matches);
    query?.addEventListener('change', sync);
  });
  onBeforeUnmount(() => query?.removeEventListener('change', sync));

  return reduced;
}

/**
 * One close at a time for a dialog: while a close is running, asking to close again returns the same
 * promise instead of starting a second animation.
 */
export function createCloseOnce() {
  let current: Promise<void> | null = null;

  return {
    get closing() {
      return current !== null;
    },
    run(close: () => Promise<void>): Promise<void> {
      if (current) {
        return current;
      }
      const tracked: Promise<void> = close().finally(() => {
        if (current === tracked) {
          current = null;
        }
      });
      current = tracked;
      return tracked;
    }
  };
}
