import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  type Ref
} from 'vue';

/**
 * Reveals each `[data-motion-module]` inside the shell once it is fully in view (the CSS plays the reveal when
 * `data-motion-visible` is set). New modules are picked up as routes render them.
 */
export function useMotionReveal(shellRef: Ref<HTMLElement | null>) {
  let revealFrame: number | undefined;
  let revealObserver: IntersectionObserver | undefined;
  let mutationObserver: MutationObserver | undefined;
  let observedModules: HTMLElement[] = [];

  function observeModule(element: HTMLElement, index: number) {
    element.style.setProperty('--motion-module-index', String(index));

    if (observedModules.includes(element)) {
      return;
    }

    observedModules.push(element);

    if (!revealObserver) {
      element.dataset.motionVisible = 'true';
      return;
    }

    revealObserver.observe(element);
  }

  function refreshModules() {
    const shell = shellRef.value;

    if (!shell) {
      return;
    }

    const modules = Array.from(
      shell.querySelectorAll<HTMLElement>('[data-motion-module]')
    );
    modules.forEach(observeModule);
    requestRevealCheck();
  }

  function stop() {
    if (revealFrame !== undefined) {
      window.cancelAnimationFrame(revealFrame);
      revealFrame = undefined;
    }

    window.removeEventListener('scroll', requestRevealCheck);
    window.removeEventListener('resize', requestRevealCheck);
    revealObserver?.disconnect();
    mutationObserver?.disconnect();
    revealObserver = undefined;
    mutationObserver = undefined;
    observedModules.forEach((element) => {
      delete element.dataset.motionVisible;
      element.style.removeProperty('--motion-module-index');
    });
    observedModules = [];
  }

  function markVisible(element: HTMLElement) {
    element.dataset.motionVisible = 'true';
    revealObserver?.unobserve(element);
  }

  function isFullyInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    return rect.top >= 0 && rect.bottom <= viewportHeight;
  }

  function revealFullyVisibleModules() {
    revealFrame = undefined;

    observedModules.forEach((element) => {
      if (
        element.dataset.motionVisible === 'true' ||
        !isFullyInViewport(element)
      ) {
        return;
      }

      markVisible(element);
    });
  }

  function requestRevealCheck() {
    if (revealFrame !== undefined) {
      return;
    }

    revealFrame = window.requestAnimationFrame(
      revealFullyVisibleModules
    );
  }

  function start() {
    stop();

    const shell = shellRef.value;

    if (!shell) {
      return;
    }

    if ('IntersectionObserver' in window) {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            const element = entry.target as HTMLElement;
            if (isFullyInViewport(element)) {
              markVisible(element);
            }
          });
        },
        {
          root: null,
          rootMargin: '0px 0px 0px 0px',
          threshold: 1
        }
      );
    }

    refreshModules();
    window.addEventListener('scroll', requestRevealCheck, {
      passive: true
    });
    window.addEventListener('resize', requestRevealCheck);
    requestRevealCheck();

    if ('MutationObserver' in window) {
      mutationObserver = new MutationObserver(refreshModules);
      mutationObserver.observe(shell, {
        childList: true,
        subtree: true
      });
    }
  }

  onMounted(() => {
    nextTick(start);
  });

  onBeforeUnmount(stop);

  return { requestRevealCheck };
}
