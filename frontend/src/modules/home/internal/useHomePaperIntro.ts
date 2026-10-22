import { prefersReducedMotion } from '../../../motion';
import { gsap } from 'gsap';
import {
  nextTick,
  onBeforeUnmount,
  watch,
  type ComponentPublicInstance,
  type WatchSource
} from 'vue';
import type { HomeOverview } from '../model';

type HomePaperIntroKey =
  | 'memoryCard'
  | 'dailyNote'
  | 'statusCards'
  | 'progressLedger'
  | 'recentCards'
  | 'nextPlan';

type TemplateRefSetter = (
  value: Element | ComponentPublicInstance | null
) => void;

const HOME_PAPER_INTRO_KEYS: HomePaperIntroKey[] = [
  'memoryCard',
  'dailyNote',
  'statusCards',
  'progressLedger',
  'recentCards',
  'nextPlan'
];

export function useHomePaperIntro(
  overview: WatchSource<HomeOverview | null>
): {
  paperIntroRef(key: HomePaperIntroKey): TemplateRefSetter;
} {
  const elements = new Map<HomePaperIntroKey, HTMLElement>();
  const refSetters = new Map<HomePaperIntroKey, TemplateRefSetter>();
  const playedModules = new Set<HomePaperIntroKey>();
  let observer: MutationObserver | undefined;
  let contexts: Array<ReturnType<typeof gsap.context>> = [];

  function paperIntroRef(key: HomePaperIntroKey): TemplateRefSetter {
    const existing = refSetters.get(key);
    if (existing) {
      return existing;
    }

    const setter: TemplateRefSetter = (value) => {
      if (value instanceof HTMLElement) {
        elements.set(key, value);
        return;
      }
      elements.delete(key);
    };
    refSetters.set(key, setter);
    return setter;
  }

  function rememberContext(context: ReturnType<typeof gsap.context>) {
    contexts.push(context);
  }

  function playMemoryCardIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.52,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.home-memory-card__tape', {
          autoAlpha: 0,
          y: 14,
          scale: 0.985,
          rotation: -0.35,
          transformOrigin: '50% 58%',
          duration: 0.72,
          ease: 'back.out(1.18)',
          clearProps: 'all'
        })
        .from(
          '.home-memory-card__line, .home-memory-card__anniversary',
          {
            autoAlpha: 0,
            y: 14,
            stagger: 0.1,
            clearProps: 'all'
          },
          '<0.1'
        )
        .from(
          '.home-memory-card__stats',
          {
            autoAlpha: 0,
            x: 20,
            scale: 0.94,
            duration: 0.58,
            clearProps: 'all'
          },
          '<0.08'
        );
    }, element);

    rememberContext(context);
  }

  function playDailyNoteIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.46,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.dashboard-section-heading', {
          autoAlpha: 0,
          y: 8,
          duration: 0.36,
          clearProps: 'all'
        })
        .from(
          '.daily-note-card',
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.97,
            rotation: -1.4,
            transformOrigin: '50% 20%',
            duration: 0.72,
            ease: 'back.out(1.28)',
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.daily-note-card__tape',
          {
            autoAlpha: 0,
            y: -14,
            scale: 0.9,
            rotation: -5,
            duration: 0.42,
            ease: 'back.out(1.7)',
            clearProps: 'all'
          },
          '<0.22'
        )
        .from(
          '.daily-note-card__sentence',
          {
            autoAlpha: 0,
            y: 10,
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.daily-note-card__meta span',
          {
            autoAlpha: 0,
            y: 8,
            stagger: 0.08,
            duration: 0.34,
            clearProps: 'all'
          },
          '<0.12'
        );
    }, element);

    rememberContext(context);
  }

  function playStatusCardsIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.44,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.dashboard-section-heading', {
          autoAlpha: 0,
          y: 8,
          duration: 0.34,
          clearProps: 'all'
        })
        .from(
          '.status-person-card',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.96,
            rotation: (index) => (index === 0 ? -0.8 : 0.8),
            transformOrigin: '50% 32%',
            stagger: 0.1,
            duration: 0.58,
            ease: 'back.out(1.2)',
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.status-person-card__avatar',
          {
            autoAlpha: 0,
            y: 8,
            scale: 0.86,
            stagger: 0.08,
            duration: 0.38,
            ease: 'back.out(1.5)',
            clearProps: 'all'
          },
          '<0.12'
        )
        .from(
          '.status-person-card__chips span, .status-person-card__mood, .status-person-card__note',
          {
            autoAlpha: 0,
            y: 6,
            stagger: 0.035,
            duration: 0.26,
            clearProps: 'all'
          },
          '<0.12'
        )
        .from(
          '.distance-ribbon',
          {
            autoAlpha: 0,
            y: 14,
            scale: 0.97,
            rotation: 0.6,
            duration: 0.52,
            ease: 'back.out(1.15)',
            clearProps: 'all'
          },
          '<0.08'
        );
    }, element);

    rememberContext(context);
  }

  function playProgressLedgerIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.46,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.dashboard-section-heading', {
          autoAlpha: 0,
          y: 8,
          duration: 0.34,
          clearProps: 'all'
        })
        .from(
          '.progress-ledger',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.985,
            rotation: -0.3,
            transformOrigin: '50% 45%',
            duration: 0.66,
            ease: 'back.out(1.12)',
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.progress-stat-card',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.92,
            stagger: { each: 0.08, from: 'center' },
            duration: 0.52,
            ease: 'back.out(1.35)',
            clearProps: 'all'
          },
          '<0.18'
        )
        .from(
          '.progress-stat-card__icon svg',
          {
            autoAlpha: 0,
            scale: 0.72,
            rotation: (index) => (index % 2 === 0 ? -8 : 8),
            stagger: 0.06,
            duration: 0.34,
            ease: 'back.out(1.8)',
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.progress-thread span',
          {
            autoAlpha: 0,
            scaleX: 0,
            transformOrigin: 'left center',
            stagger: 0.08,
            duration: 0.38,
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.progress-ledger__labels span',
          {
            autoAlpha: 0,
            y: 8,
            stagger: 0.08,
            duration: 0.32,
            clearProps: 'all'
          },
          '<0.08'
        );
    }, element);

    rememberContext(context);
  }

  function playRecentCardsIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.48,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.dashboard-section-heading', {
          autoAlpha: 0,
          y: 8,
          duration: 0.34,
          clearProps: 'all'
        })
        .from(
          '.recent-paper-item',
          {
            autoAlpha: 0,
            y: 24,
            scale: 0.96,
            rotation: (index) => [-1, 0.8, -0.4][index] ?? 0,
            transformOrigin: '50% 20%',
            stagger: 0.11,
            duration: 0.66,
            ease: 'back.out(1.18)',
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.recent-paper-card__label',
          {
            autoAlpha: 0,
            y: 8,
            stagger: 0.08,
            duration: 0.3,
            clearProps: 'all'
          },
          '<0.16'
        )
        .from(
          '.recent-paper-card__tape',
          {
            autoAlpha: 0,
            y: -10,
            scale: 0.88,
            rotation: (index) => (index === 0 ? -5 : 5),
            stagger: 0.08,
            duration: 0.34,
            ease: 'back.out(1.7)',
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.recent-paper-card__photo, .album-preview-strip img, .recent-message-author__avatar',
          {
            autoAlpha: 0,
            y: 8,
            scale: 0.9,
            stagger: 0.06,
            duration: 0.38,
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.recent-paper-card__copy, .recent-message-author, .recent-paper-card--message p, .album-preview-footer',
          {
            autoAlpha: 0,
            y: 10,
            stagger: 0.07,
            duration: 0.36,
            clearProps: 'all'
          },
          '<0.1'
        );
    }, element);

    rememberContext(context);
  }

  function playNextPlanIntro(element: HTMLElement) {
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: {
          duration: 0.46,
          ease: 'power3.out'
        }
      });

      timeline
        .from('.dashboard-section-heading', {
          autoAlpha: 0,
          y: 8,
          duration: 0.34,
          clearProps: 'all'
        })
        .from(
          '.next-plan-strip',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.985,
            rotation: 0.4,
            transformOrigin: '50% 50%',
            duration: 0.64,
            ease: 'back.out(1.18)',
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.next-plan-strip__tape',
          {
            autoAlpha: 0,
            y: -12,
            scale: 0.88,
            rotation: -4,
            duration: 0.34,
            ease: 'back.out(1.7)',
            clearProps: 'all'
          },
          '<0.2'
        )
        .from(
          '.next-plan-strip__check',
          {
            autoAlpha: 0,
            scale: 0.72,
            rotation: -8,
            duration: 0.36,
            ease: 'back.out(1.8)',
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.next-plan-strip__content > div',
          {
            autoAlpha: 0,
            y: 8,
            stagger: 0.08,
            duration: 0.36,
            clearProps: 'all'
          },
          '<0.06'
        )
        .from(
          '.next-plan-strip__link',
          {
            autoAlpha: 0,
            x: 12,
            duration: 0.34,
            clearProps: 'all'
          },
          '<0.08'
        );
    }, element);

    rememberContext(context);
  }

  const players: Record<
    HomePaperIntroKey,
    (element: HTMLElement) => void
  > = {
    memoryCard: playMemoryCardIntro,
    dailyNote: playDailyNoteIntro,
    statusCards: playStatusCardsIntro,
    progressLedger: playProgressLedgerIntro,
    recentCards: playRecentCardsIntro,
    nextPlan: playNextPlanIntro
  };

  function playIfVisible(key: HomePaperIntroKey) {
    const element = elements.get(key);
    if (
      !element ||
      playedModules.has(key) ||
      element.dataset.motionVisible !== 'true'
    ) {
      return;
    }

    playedModules.add(key);
    if (prefersReducedMotion()) {
      return;
    }
    players[key](element);
  }

  function refreshAnimations() {
    HOME_PAPER_INTRO_KEYS.forEach(playIfVisible);
  }

  function startTracking() {
    observer?.disconnect();
    observer = undefined;

    const targets = HOME_PAPER_INTRO_KEYS.map((key) =>
      elements.get(key)
    ).filter((target): target is HTMLElement => Boolean(target));

    if ('MutationObserver' in window && targets.length > 0) {
      observer = new MutationObserver(refreshAnimations);
      targets.forEach((target) => {
        observer?.observe(target, {
          attributes: true,
          attributeFilter: ['data-motion-visible']
        });
      });
    }

    refreshAnimations();
  }

  function stop() {
    observer?.disconnect();
    observer = undefined;
    contexts.forEach((context) => context.revert());
    contexts = [];
  }

  watch(
    overview,
    (value) => {
      if (!value) {
        return;
      }
      nextTick(startTracking);
    },
    { immediate: true, flush: 'post' }
  );

  onBeforeUnmount(stop);

  return { paperIntroRef };
}
