import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref
} from 'vue';
import { gsap, revealTitle } from '../../../motionKit';
import type { AlbumCollection } from '../model';

const CARD_REVEAL_RATIO = 0.33;
const MASONRY_ROW_SIZE = 8;
const MASONRY_GAP = 28;
const BOTTOM_LOAD_THRESHOLD = 260;

type AlbumCatalogPresentationOptions = {
  collections: Readonly<Ref<AlbumCollection[]>>;
  loaded: Readonly<Ref<boolean>>;
  reducedMotion: boolean;
  loadNextPage(): Promise<unknown>;
};

export function useAlbumCatalogPresentation({
  collections,
  loaded,
  reducedMotion,
  loadNextPage
}: AlbumCatalogPresentationOptions) {
  const pageInnerRef = ref<HTMLElement | null>(null);
  const visibleCardIds = ref<Set<string>>(new Set());
  const cardMasonrySpans = ref<Record<string, number>>({});
  const activeCardId = ref<string | null>(null);
  const cardPointerX = ref('0px');
  const cardPointerY = ref('0px');
  const cardPointerDeltaX = ref(0);
  const cardPointerDeltaY = ref(0);
  const gsapMotionAttr = computed(() => (reducedMotion ? undefined : 'true'));

  const cardElements = new Map<string, HTMLElement>();
  const cardMotionContexts = new Map<string, ReturnType<typeof gsap.context>>();
  let cardRevealObserver: IntersectionObserver | undefined;
  let masonryResizeObserver: ResizeObserver | undefined;
  let masonryMeasureFrame: number | undefined;
  let pageIntroContext: ReturnType<typeof gsap.context> | undefined;

  watch(
    () => collections.value.length,
    () => {
      void nextTick(() => {
        setupCardRevealObserver();
        setupMasonryObserver();
      });
    }
  );

  watch(
    loaded,
    (isLoaded) => {
      if (isLoaded) {
        void nextTick(playPageIntro);
      }
    },
    { flush: 'post' }
  );

  function playPageIntro() {
    const root = pageInnerRef.value;

    if (!root || reducedMotion || pageIntroContext) {
      return;
    }

    pageIntroContext = gsap.context(() => {
      const createEntry = root.querySelector<HTMLElement>('.album-create-fab');
      const draftEntries = Array.from(
        root.querySelectorAll<HTMLElement>(
          '.album-hero-actions .album-create-entry'
        )
      );
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.52,
          ease: 'power3.out',
          overwrite: 'auto'
        }
      });

      timeline
        .from('.album-hero-row', {
          autoAlpha: 0,
          y: 24,
          rotationX: 2,
          transformOrigin: 'left top',
          duration: 0.58,
          clearProps: 'opacity,transform,visibility'
        })
        .add(() => revealTitle(root.querySelector('.album-hero__title-text')), '<0.05')
        .from(
          '.album-hero p, .album-hero__copy',
          {
            autoAlpha: 0,
            y: 18,
            stagger: 0.06,
            clearProps: 'all'
          },
          '<0.1'
        )
        .from(
          '.album-title-heart',
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.78,
            rotation: -10,
            duration: 0.42,
            ease: 'back.out(1.7)',
            clearProps: 'all'
          },
          '<0.12'
        )
        .from(
          '.album-hero-art .album-asset',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.88,
            rotation: (index) => (index === 0 ? 8 : -5),
            stagger: 0.1,
            duration: 0.56,
            ease: 'back.out(1.28)',
            clearProps: 'all'
          },
          '<0.02'
        );

      if (draftEntries.length > 0) {
        timeline.from(
          draftEntries,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.94,
            stagger: 0.04,
            duration: 0.34,
            clearProps: 'all'
          },
          '<0.06'
        );
      }

      // The postmark turns a little and drifts down as the hero scrolls away.
      const heroRow = root.querySelector('.album-hero-row');
      if (heroRow) {
        gsap.to('.album-postmark', {
          rotation: 26,
          y: 54,
          ease: 'none',
          scrollTrigger: { trigger: heroRow, start: 'top 20%', end: 'bottom top', scrub: 0.6 }
        });
      }

      if (createEntry) {
        timeline.from(
          createEntry,
          {
            autoAlpha: 0,
            y: 28,
            scale: 0.84,
            rotation: 8,
            duration: 0.48,
            ease: 'back.out(1.45)',
            clearProps: 'all'
          },
          '<0.18'
        );
      }
    }, root);
  }

  function playCardReveal(collectionId: string) {
    const element = cardElements.get(collectionId);

    if (
      !element ||
      reducedMotion ||
      cardMotionContexts.has(collectionId)
    ) {
      return;
    }

    const order = Math.min(
      Number(element.dataset.albumRevealOrder ?? 0),
      8
    );
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        delay: order * 0.035,
        defaults: {
          ease: 'power3.out',
          overwrite: 'auto'
        }
      });

      timeline
        .from(element, {
          autoAlpha: 0,
          y: 28,
          scale: 0.965,
          rotation: order % 2 === 0 ? -0.5 : 0.5,
          transformOrigin: '50% 18%',
          duration: 0.62,
          ease: 'back.out(1.14)',
          clearProps: 'opacity,transform,visibility'
        })
        .from(
          '.album-collection-author__avatar',
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.82,
            rotation: -8,
            duration: 0.3,
            ease: 'back.out(1.5)',
            clearProps: 'all'
          },
          '<0.12'
        )
        .from(
          '.album-collection-author__name, .album-collection-author time',
          {
            autoAlpha: 0,
            x: -8,
            stagger: 0.035,
            duration: 0.28,
            clearProps: 'all'
          },
          '<0.04'
        )
        .from(
          '.album-collection-card__open',
          {
            autoAlpha: 0,
            x: 8,
            scale: 0.86,
            duration: 0.3,
            ease: 'back.out(1.35)',
            clearProps: 'all'
          },
          '<0.02'
        )
        .from(
          '.album-collection-card__title',
          {
            autoAlpha: 0,
            y: 12,
            duration: 0.34,
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.album-collection-preview__cell, .album-private-panel',
          {
            autoAlpha: 0,
            y: 16,
            scale: 0.92,
            rotation: (index) =>
              [-1.4, 0.8, 1.2, 0.6, -0.7, -1, -0.5, 1, 0.35][index] ?? 0,
            stagger: { each: 0.026, from: 'center' },
            duration: 0.42,
            ease: 'back.out(1.38)',
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.album-collection-card__footer span, .album-collection-card__footer button',
          {
            autoAlpha: 0,
            y: 7,
            stagger: 0.035,
            duration: 0.28,
            clearProps: 'all'
          },
          '<0.12'
        );
    }, element);

    cardMotionContexts.set(collectionId, context);
  }

  function stopCardMotion(collectionId: string) {
    cardMotionContexts.get(collectionId)?.revert();
    cardMotionContexts.delete(collectionId);
  }

  function isCardVisible(collectionId: string) {
    return reducedMotion || visibleCardIds.value.has(collectionId);
  }

  function markCardVisible(collectionId: string) {
    if (visibleCardIds.value.has(collectionId)) {
      return;
    }

    visibleCardIds.value = new Set([
      ...visibleCardIds.value,
      collectionId
    ]);
    void nextTick(() => playCardReveal(collectionId));
  }

  function setupCardRevealObserver() {
    if (
      reducedMotion ||
      typeof window.IntersectionObserver !== 'function'
    ) {
      collections.value.forEach((collection) =>
        markCardVisible(collection.id)
      );
      return;
    }

    cardRevealObserver?.disconnect();
    cardRevealObserver = new IntersectionObserver(
      (entries) => {
        entries
          .filter(
            (entry) =>
              entry.isIntersecting &&
              entry.intersectionRatio >= CARD_REVEAL_RATIO
          )
          .sort((left, right) => {
            const leftOrder = Number(
              (left.target as HTMLElement).dataset.albumRevealOrder ?? 0
            );
            const rightOrder = Number(
              (right.target as HTMLElement).dataset.albumRevealOrder ?? 0
            );
            return leftOrder - rightOrder;
          })
          .forEach((entry) => {
            const collectionId = (entry.target as HTMLElement).dataset.albumId;
            if (!collectionId) {
              return;
            }

            markCardVisible(collectionId);
            cardRevealObserver?.unobserve(entry.target);
          });
      },
      { threshold: [CARD_REVEAL_RATIO] }
    );

    cardElements.forEach((element, collectionId) => {
      if (!isCardVisible(collectionId)) {
        cardRevealObserver?.observe(element);
      }
    });
  }

  function fallbackMasonrySpan(collection: AlbumCollection) {
    const estimatedHeight = collection.locked ? 360 : 520;
    return Math.ceil(
      (estimatedHeight + MASONRY_GAP) / MASONRY_ROW_SIZE
    );
  }

  function measureMasonry() {
    masonryMeasureFrame = undefined;
    const nextSpans: Record<string, number> = {};

    cardElements.forEach((element, collectionId) => {
      const cardHeight =
        element.getBoundingClientRect().height ||
        element.offsetHeight ||
        element.scrollHeight;
      nextSpans[collectionId] = Math.max(
        1,
        Math.ceil((cardHeight + MASONRY_GAP) / MASONRY_ROW_SIZE)
      );
    });

    cardMasonrySpans.value = nextSpans;
  }

  function scheduleMasonryMeasure() {
    if (
      masonryMeasureFrame !== undefined
    ) {
      return;
    }

    masonryMeasureFrame = window.requestAnimationFrame(measureMasonry);
  }

  function setupMasonryObserver() {
    if (typeof window.ResizeObserver !== 'function') {
      scheduleMasonryMeasure();
      return;
    }

    masonryResizeObserver?.disconnect();
    masonryResizeObserver = new ResizeObserver(() =>
      scheduleMasonryMeasure()
    );
    cardElements.forEach((element) =>
      masonryResizeObserver?.observe(element)
    );
    scheduleMasonryMeasure();
  }

  function setCardRef(
    collectionId: string,
    element: HTMLElement | null
  ) {
    const previousElement = cardElements.get(collectionId);
    if (previousElement && previousElement !== element) {
      cardRevealObserver?.unobserve(previousElement);
      masonryResizeObserver?.unobserve(previousElement);
    }

    if (!element) {
      cardElements.delete(collectionId);
      stopCardMotion(collectionId);
      scheduleMasonryMeasure();
      return;
    }

    cardElements.set(collectionId, element);
    if (cardRevealObserver && !isCardVisible(collectionId)) {
      cardRevealObserver.observe(element);
    }
    masonryResizeObserver?.observe(element);
    scheduleMasonryMeasure();
  }

  function getCardStyle(
    collection: AlbumCollection,
    index: number
  ): Record<string, string> {
    const isActive = activeCardId.value === collection.id;

    return {
      '--album-card-masonry-span': `${
        cardMasonrySpans.value[collection.id] ??
        fallbackMasonrySpan(collection)
      }`,
      '--album-card-reveal-index': `${index}`,
      '--album-card-pointer-x': isActive ? cardPointerX.value : '0px',
      '--album-card-pointer-y': isActive ? cardPointerY.value : '0px'
    };
  }

  function getPreviewCellStyle(
    collection: AlbumCollection,
    index: number
  ): Record<string, string> {
    const isActive = activeCardId.value === collection.id;
    const col = (index % 3) - 1;
    const row = Math.floor(index / 3) - 1;
    const xDepth = 1.8 + Math.abs(col) * 0.4 + Math.abs(row) * 0.16;
    const yDepth = 1.35 + Math.abs(row) * 0.32 + Math.abs(col) * 0.12;
    const x = isActive
      ? cardPointerDeltaX.value * xDepth + col * 1.4
      : 0;
    const y = isActive
      ? cardPointerDeltaY.value * yDepth + row * 1.8
      : 0;

    return {
      '--album-preview-index': `${index}`,
      '--album-preview-parallax-x': `${x.toFixed(2)}px`,
      '--album-preview-parallax-y': `${y.toFixed(2)}px`,
      '--album-preview-image-x': `${(-x * 0.38).toFixed(2)}px`,
      '--album-preview-image-y': `${(-y * 0.38).toFixed(2)}px`
    };
  }

  function setActiveCard(collection: AlbumCollection) {
    if (!collection.locked && !reducedMotion) {
      activeCardId.value = collection.id;
    }
  }

  function clearActiveCard(collectionId: string) {
    if (activeCardId.value !== collectionId) {
      return;
    }

    activeCardId.value = null;
    cardPointerX.value = '0px';
    cardPointerY.value = '0px';
    cardPointerDeltaX.value = 0;
    cardPointerDeltaY.value = 0;
  }

  function handleCardPointerMove(
    event: PointerEvent,
    collection: AlbumCollection
  ) {
    if (
      collection.locked ||
      reducedMotion ||
      !(event.currentTarget instanceof HTMLElement)
    ) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--lamp-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--lamp-y', `${event.clientY - rect.top}px`);
    const xRatio =
      rect.width > 0
        ? (event.clientX - rect.left) / rect.width - 0.5
        : 0;
    const yRatio =
      rect.height > 0
        ? (event.clientY - rect.top) / rect.height - 0.5
        : 0;
    const x = Math.max(-1, Math.min(1, xRatio * 2)) * 4.35;
    const y = Math.max(-1, Math.min(1, yRatio * 2)) * 3.45;

    activeCardId.value = collection.id;
    cardPointerX.value = `${x.toFixed(2)}px`;
    cardPointerY.value = `${y.toFixed(2)}px`;
    cardPointerDeltaX.value = x;
    cardPointerDeltaY.value = y;
  }

  function isNearBottom() {
    const scrollHeight =
      document.documentElement.scrollHeight || document.body.scrollHeight;
    return (
      window.scrollY + window.innerHeight >=
      scrollHeight - BOTTOM_LOAD_THRESHOLD
    );
  }

  function handleWindowScroll() {
    if (isNearBottom()) {
      void loadNextPage();
    }
  }

  function stop() {
    cardRevealObserver?.disconnect();
    masonryResizeObserver?.disconnect();
    if (masonryMeasureFrame !== undefined) {
      window.cancelAnimationFrame(masonryMeasureFrame);
    }
    cardElements.clear();
    pageIntroContext?.revert();
    pageIntroContext = undefined;
    cardMotionContexts.forEach((context) => context.revert());
    cardMotionContexts.clear();
  }

  onMounted(() => {
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', handleWindowScroll);
    stop();
  });

  return {
    pageInnerRef,
    gsapMotionAttr,
    activeCardId,
    isCardVisible,
    setCardRef,
    getCardStyle,
    getPreviewCellStyle,
    setActiveCard,
    clearActiveCard,
    handleCardPointerMove
  };
}
