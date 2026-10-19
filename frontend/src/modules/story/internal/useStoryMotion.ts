import { computed, nextTick, onMounted, onUnmounted, ref, type Ref } from 'vue';
import { gsap } from 'gsap';
import { isInstantMotion, useMotionSlots, useReducedMotion } from '../../../motion';

/** The map canvas camera and marker choreography the page entry drives. */
export interface StoryMapMotion {
  prepareEntryCamera(options: { isMobile: boolean }): unknown;
  playEntryCamera(options: { isMobile: boolean }): unknown;
  playMarkerReveal(options: { ids?: number[]; replayVisible?: boolean; isMobile: boolean }): unknown;
}

export interface StoryMotionOptions {
  root: Ref<HTMLElement | null>;
  map: Ref<StoryMapMotion | null>;
  canManage: Ref<boolean>;
  /** The moment list and the map are ready, so the preloader may leave and the camera may fly in. */
  bootReady: Ref<boolean>;
  /** The page entry waits while the list loads, after a load error, or while the editor is open. */
  loading: Ref<boolean>;
  loadError: Ref<string>;
  editorOpen: Ref<boolean>;
}

type StorySlot = 'enter' | 'enterScope' | 'select' | 'selectScope' | 'save' | 'saveScope' | 'delete' | 'deleteScope' | 'confirm' | 'confirmScope';

const MOBILE_QUERY = '(max-width: 767px)';

function isMobileViewport() {
  return Boolean(window.matchMedia?.(MOBILE_QUERY).matches);
}

function markerDescendantSelector(id: number, descendant: string) {
  return `[data-story-motion-id="${id}"] ${descendant}, [data-story-group-ids~="${id}"] ${descendant}`;
}

/**
 * The Story page choreography: preloader exit, the one-time map entry, and feedback for selecting, saving and
 * deleting moments. It decides nothing about Story data; the view calls it for changes that already happened
 * (a delete plays after the server confirmed it). Everything it starts stops when the page unmounts.
 */
export function useStoryMotion(options: StoryMotionOptions) {
  const { root, map, canManage, bootReady, loading, loadError, editorOpen } = options;
  const slots = useMotionSlots<StorySlot>();
  const reducedMotion = useReducedMotion();
  const motionReady = ref(false);
  const entered = ref(false);
  const mapEntering = ref(false);
  const preloaderRevealed = ref(false);
  const preloaderLeaving = ref(false);
  const feedbackId = ref<number | null>(null);
  let feedbackTimer: ReturnType<typeof window.setTimeout> | null = null;
  let preparedMapEntry = false;
  let playedPageEnter = false;

  /** Story controls stay locked until the entry has played (it never plays with reduced or instant motion). */
  const entryLocked = computed(
    () => mapEntering.value || (!entered.value && !reducedMotion.value && !isInstantMotion())
  );

  onMounted(() => {
    motionReady.value = true;
  });
  onUnmounted(clearFeedback);

  function completePageEnter(cleanupTargets?: { filter?: Element[]; transform?: Element[]; visibility?: Element[] }) {
    entered.value = true;
    mapEntering.value = false;
    if (!cleanupTargets) {
      return;
    }

    nextTick(() => {
      window.requestAnimationFrame(() => {
        if (!root.value) {
          return;
        }
        if (cleanupTargets.filter?.length) {
          gsap.set(cleanupTargets.filter, { clearProps: 'filter' });
        }
        if (cleanupTargets.transform?.length) {
          gsap.set(cleanupTargets.transform, { clearProps: 'transform' });
        }
        if (cleanupTargets.visibility?.length) {
          gsap.set(cleanupTargets.visibility, { clearProps: 'visibility' });
        }
      });
    });
  }

  function prepareMapEntryCamera() {
    if (preparedMapEntry || !bootReady.value || reducedMotion.value || isInstantMotion()) {
      return;
    }
    preparedMapEntry = true;
    map.value?.prepareEntryCamera({ isMobile: isMobileViewport() });
  }

  function playPageEnter() {
    if (playedPageEnter || !preloaderRevealed.value || loading.value || loadError.value || editorOpen.value || !root.value) {
      return;
    }

    playedPageEnter = true;
    mapEntering.value = true;
    prepareMapEntryCamera();
    if (isInstantMotion()) {
      completePageEnter();
      return;
    }

    slots.stop('enter');
    slots.stop('enterScope');
    const page = root.value;
    const q = gsap.utils.selector(page);

    if (reducedMotion.value) {
      gsap.set(
        [
          ...q('.story-map-canvas__surface'),
          ...q('.story-map-page__tone'),
          ...q('.story-status-badge'),
          ...q('.story-memory-entry'),
          ...q('.story-home-link'),
          ...q('.story-filter-panel'),
          ...q('.story-add-button'),
          ...q('.story-timeline'),
          ...q('.story-timeline__line'),
          ...q('.story-timeline__node'),
          ...q('.story-marker__visual')
        ],
        { autoAlpha: 1, x: 0, y: 0, scale: 1, scaleX: 1, rotation: 0, clearProps: 'transform,visibility,filter' }
      );
      gsap.set(q('.story-map-entry-veil'), { autoAlpha: 0 });
      completePageEnter();
      return;
    }

    const scope = slots.hold('enterScope', gsap.matchMedia());
    scope.add(
      '(min-width: 0px)',
      () => {
        const isMobile = isMobileViewport();
        const mapSurface = q('.story-map-canvas__surface');
        const entryVeil = q('.story-map-entry-veil');
        const toneLayer = q('.story-map-page__tone');
        const statusBadge = q('.story-status-badge');
        const memoryEntryButton = q('.story-memory-entry');
        const homeLink = q('.story-home-link');
        const addButton = canManage.value ? q('.story-add-button') : [];
        const filterChrome = isMobile ? q('.story-filter-trigger') : q('.story-filter-panel');
        const timeline = q('.story-timeline');
        const timelineLine = q('.story-timeline__line');
        const timelineNodes = q('.story-timeline__node');
        const visibilityCleanupTargets = [
          ...mapSurface,
          ...entryVeil,
          ...toneLayer,
          ...statusBadge,
          ...memoryEntryButton,
          ...homeLink,
          ...filterChrome,
          ...addButton,
          ...timeline,
          ...timelineNodes
        ];
        const transformCleanupTargets = [
          ...statusBadge,
          ...memoryEntryButton,
          ...homeLink,
          ...filterChrome,
          ...addButton,
          ...timeline,
          ...timelineLine,
          ...timelineNodes
        ];

        const enter = slots.hold(
          'enter',
          gsap.timeline({
            defaults: { ease: 'power3.out', overwrite: 'auto' },
            onComplete: () => {
              completePageEnter({
                filter: mapSurface,
                transform: transformCleanupTargets,
                visibility: visibilityCleanupTargets
              });
            }
          })
        );
        const mapRevealDuration = isMobile ? 0.28 : 0.42;
        const cameraInAt = isMobile ? 0.16 : 0.2;
        const chromeInAt = isMobile ? 1.88 : 2.65;
        const timelineInAt = isMobile ? 2.05 : 2.95;
        const veilFadeAt = isMobile ? 2.02 : 2.82;
        const veilFadeDuration = isMobile ? 0.42 : 0.68;
        const markerRevealGap = isMobile ? 0.06 : 0.12;
        const entryCompleteHold = isMobile ? 0.12 : 0.16;

        enter
          .addLabel('loaderOut', 0)
          .addLabel('mapFarReveal', isMobile ? 0.06 : 0.12)
          .fromTo(mapSurface, { autoAlpha: 0.18, filter: 'brightness(.72)' }, { autoAlpha: 1, filter: 'brightness(1)', duration: mapRevealDuration }, 'mapFarReveal')
          .fromTo(entryVeil, { autoAlpha: isMobile ? 0.42 : 0.54 }, { autoAlpha: isMobile ? 0.38 : 0.5, duration: mapRevealDuration, ease: 'power2.out' }, 'mapFarReveal')
          .fromTo(toneLayer, { autoAlpha: 0 }, { autoAlpha: 1, duration: isMobile ? 0.24 : 0.36, ease: 'power2.out' }, 'mapFarReveal+=0.06')
          .addLabel('cameraIn', cameraInAt)
          .call(() => {
            void map.value?.playEntryCamera({ isMobile });
          }, [], 'cameraIn')
          .addLabel('mapVeilOut', veilFadeAt)
          .to(entryVeil, { autoAlpha: 0, duration: veilFadeDuration, ease: 'power2.out' }, 'mapVeilOut')
          .addLabel('chromeIn', chromeInAt)
          .fromTo(statusBadge, { autoAlpha: 0, y: isMobile ? -4 : -10, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: isMobile ? 0.22 : 0.28 }, 'chromeIn')
          .fromTo(memoryEntryButton, { autoAlpha: 0, y: isMobile ? -2 : -6, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: isMobile ? 0.18 : 0.24 }, 'chromeIn+=0.04')
          .fromTo(homeLink, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: isMobile ? 0.18 : 0.22, ease: 'power2.out' }, 'chromeIn+=0.06')
          .fromTo(
            filterChrome,
            { autoAlpha: 0, x: isMobile ? 0 : -16, y: isMobile ? 10 : 0, rotation: isMobile ? 0 : -1 },
            { autoAlpha: 1, x: 0, y: 0, rotation: 0, duration: isMobile ? 0.22 : 0.34 },
            'chromeIn+=0.08'
          );

        if (addButton.length) {
          enter.fromTo(
            addButton,
            { autoAlpha: 0, scale: 0.86, rotation: isMobile ? 0 : 2.2 },
            { autoAlpha: 1, scale: 1, rotation: 0, duration: isMobile ? 0.22 : 0.28, ease: 'back.out(1.25)' },
            isMobile ? 'chromeIn+=0.12' : 'chromeIn+=0.2'
          );
        }

        enter
          .addLabel('timelineDraw', timelineInAt)
          .fromTo(timeline, { autoAlpha: 0, y: isMobile ? 12 : 18 }, { autoAlpha: 1, y: 0, duration: isMobile ? 0.24 : 0.32 }, 'timelineDraw')
          .fromTo(
            timelineLine,
            { scaleX: 0, transformOrigin: 'left center' },
            { scaleX: 1, duration: isMobile ? 0.38 : 0.52, ease: 'power2.inOut' },
            'timelineDraw+=0.12'
          )
          .fromTo(
            timelineNodes,
            { autoAlpha: 0, scale: 0.72, y: 6 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, stagger: { each: isMobile ? 0.012 : 0.035, from: 'start' } },
            'timelineDraw+=0.18'
          )
          .addLabel('markerReveal', `+=${markerRevealGap}`)
          .call(() => {
            void map.value?.playMarkerReveal({ replayVisible: true, isMobile });
          }, [], 'markerReveal');

        enter.addLabel('entryComplete', `markerReveal+=${entryCompleteHold}`).to({}, { duration: 0.01 }, 'entryComplete');

        if (!enter.getChildren(false, true, true).length) {
          completePageEnter();
        }
      },
      page
    );
  }

  /** The list and map are ready (or failed): let the preloader go. */
  function startPreloaderExit() {
    if (preloaderRevealed.value || preloaderLeaving.value) {
      return;
    }

    if (bootReady.value) {
      mapEntering.value = !reducedMotion.value && !isInstantMotion();
      prepareMapEntryCamera();
    }

    if (isInstantMotion()) {
      completePreloaderReveal();
      return;
    }

    preloaderLeaving.value = true;
  }

  /** The preloader finished leaving. */
  function completePreloaderReveal() {
    preloaderRevealed.value = true;
    preloaderLeaving.value = false;
    if (loadError.value) {
      mapEntering.value = false;
      return;
    }
    nextTick(playPageEnter);
  }

  function playSelection(id: number) {
    slots.stop('select');
    slots.stop('selectScope');
    if (reducedMotion.value || isInstantMotion() || !root.value) {
      return;
    }

    const page = root.value;
    slots.hold(
      'selectScope',
      gsap.context(() => {
        const pulse = page.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__pulse'));
        const markerVisual = page.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__visual'));
        const node = page.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
        const dot = node?.querySelector<HTMLElement>('.story-timeline__dot');

        const select = slots.hold('select', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));
        if (markerVisual) {
          select.fromTo(markerVisual, { scale: 1 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
        }
        if (node) {
          select.fromTo(node, { scale: 1 }, { scale: 1.05, duration: 0.12, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
        }
        if (dot) {
          select.fromTo(dot, { scale: 0.9 }, { scale: 1.14, duration: 0.18, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
        }
        if (pulse) {
          select.fromTo(pulse, { autoAlpha: 0.38, scale: 0.8 }, { autoAlpha: 0, scale: 2.25, duration: 0.55, clearProps: 'transform,visibility' }, 0.04);
        }
      }, page)
    );
  }

  function playDeleteConfirmOpen() {
    slots.stop('confirm');
    slots.stop('confirmScope');
    if (reducedMotion.value || isInstantMotion() || !root.value) {
      return;
    }
    slots.hold(
      'confirmScope',
      gsap.context(() => {
        slots.hold(
          'confirm',
          gsap.fromTo(
            '.story-delete-confirm',
            { autoAlpha: 0, scale: 0.96, y: 6 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'transform,visibility' }
          )
        );
      }, root.value)
    );
  }

  /** Fades out a deleted moment's confirm card, marker, timeline node and detail. */
  function playDelete(id: number): Promise<void> {
    slots.stop('delete');
    slots.stop('select');
    slots.stop('deleteScope');

    if (reducedMotion.value || isInstantMotion() || !root.value) {
      return Promise.resolve();
    }

    const page = root.value;
    return new Promise<void>((resolve) => {
      slots.hold(
        'deleteScope',
        gsap.context(() => {
          const confirm = page.querySelector<HTMLElement>('.story-delete-confirm');
          const markerVisual = page.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__visual'));
          const node = page.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
          const detail = page.querySelector<HTMLElement>('.moment-detail');

          if (!confirm && !markerVisual && !node && !detail) {
            resolve();
            return;
          }

          const fade = slots.hold(
            'delete',
            gsap.timeline({ defaults: { ease: 'power2.inOut', overwrite: 'auto' }, onComplete: resolve, onInterrupt: resolve })
          );
          if (confirm) {
            fade.to(confirm, { autoAlpha: 0, scale: 0.985, duration: 0.1, ease: 'power1.out' }, 0);
          }
          if (markerVisual) {
            fade.to(markerVisual, { autoAlpha: 0, scale: 0.62, rotation: -3, duration: 0.22, clearProps: 'transform,visibility' }, 0.04);
          }
          if (node) {
            fade.to(node, { autoAlpha: 0, scale: 0.72, y: 4, duration: 0.2, clearProps: 'transform,visibility' }, 0.08);
          }
          if (detail) {
            fade.to(detail, { autoAlpha: 0, scale: 0.985, y: 4, duration: 0.12, ease: 'power1.out', clearProps: 'transform,visibility' }, 0.04);
          }
        }, page)
      );
    });
  }

  /** Marks a just-saved moment so its marker and timeline node can show feedback once they render. */
  function markSaved(id: number) {
    feedbackId.value = id;
  }

  /** Celebrates a saved moment on the map and timeline. */
  function playSaved(id: number) {
    clearFeedback();
    feedbackId.value = id;

    if (!reducedMotion.value && !isInstantMotion()) {
      nextTick(() => {
        const page = root.value;
        if (!page) {
          return;
        }
        slots.hold(
          'saveScope',
          gsap.context(() => {
            const markerPulse = page.querySelector<HTMLElement>(markerDescendantSelector(id, '.story-marker__pulse'));
            const timelineNode = page.querySelector<HTMLElement>(`.story-timeline__node[data-story-motion-id="${id}"]`);
            const timelineDot = timelineNode?.querySelector<HTMLElement>('.story-timeline__dot');

            const saved = slots.hold('save', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }).addLabel('markerIn', 0));
            void map.value?.playMarkerReveal({ ids: [id], replayVisible: true, isMobile: isMobileViewport() });
            if (markerPulse) {
              saved.fromTo(markerPulse, { autoAlpha: 0.34, scale: 0.85 }, { autoAlpha: 0, scale: 2.2, duration: 0.46, clearProps: 'transform,visibility' }, 'markerIn+=0.36');
            }
            if (timelineNode) {
              saved.fromTo(timelineNode, { autoAlpha: 0.72, scale: 0.86, y: 4 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.26, clearProps: 'transform,visibility' }, 'markerIn+=0.14');
            }
            if (timelineDot) {
              saved.fromTo(timelineDot, { scale: 0.8 }, { scale: 1.18, duration: 0.2, yoyo: true, repeat: 1, clearProps: 'transform' }, 'markerIn+=0.18');
            }
          }, page)
        );
      });
    }

    feedbackTimer = window.setTimeout(() => {
      feedbackId.value = null;
      feedbackTimer = null;
      slots.stop('save');
      slots.stop('saveScope');
    }, reducedMotion.value ? 120 : 860);
  }

  function clearFeedback() {
    if (feedbackTimer) {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    feedbackId.value = null;
    slots.stop('save');
  }

  return {
    reducedMotion,
    motionReady,
    entered,
    mapEntering,
    entryLocked,
    preloaderRevealed,
    preloaderLeaving,
    feedbackId,
    playPageEnter,
    startPreloaderExit,
    completePreloaderReveal,
    playSelection,
    playDeleteConfirmOpen,
    playDelete,
    markSaved,
    playSaved,
    clearFeedback
  };
}
