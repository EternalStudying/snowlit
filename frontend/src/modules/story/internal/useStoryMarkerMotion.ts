import { gsap } from 'gsap';
import type { Ref } from 'vue';
import { useMotionSlots } from '../../../motion';
import type { StoryEditorAnchor, StoryMoment } from '../model';
import { sortStoryMomentsForReveal, type StoryMarkerItem } from './storyMapModel';

export type MarkerRevealOptions = {
  ids?: number[];
  replayVisible?: boolean;
  isMobile?: boolean;
};

type RevealItem = {
  id: number;
  ids: number[];
  root: HTMLElement;
  visual: HTMLElement;
  glint: HTMLElement | null;
  pulse: HTMLElement | null;
};

export interface StoryMarkerMotionOptions {
  /** The map surface that contains the marker elements. */
  surface: Ref<HTMLElement | null>;
  reducedMotion: () => boolean;
  selectedId: () => number | null;
}

function isMobileViewport() {
  return Boolean(window.matchMedia?.('(max-width: 767px)').matches);
}

function fullRevealLimit(total: number, isMobile: boolean) {
  if (isMobile) {
    return Math.min(total, total > 18 ? 8 : total);
  }
  if (total <= 12) {
    return total;
  }
  if (total <= 40) {
    return Math.min(total, 12);
  }
  return Math.min(total, 8);
}

function revealStagger(total: number, isMobile: boolean) {
  if (isMobile) {
    return total > 18 ? 0.018 : 0.035;
  }
  if (total <= 12) {
    return 0.06;
  }
  if (total <= 24) {
    return 0.045;
  }
  return 0.04;
}

function clearRevealClasses(roots: HTMLElement[]) {
  roots.forEach((root) => root.classList.remove('is-animating', 'is-reveal-pending'));
}

/**
 * Story map marker choreography: the staggered reveal of markers not yet shown, the selected-marker pulse, the
 * draft-marker pop and the click ripple. It remembers which moments have been revealed so a re-render only
 * animates new markers. Everything stops when the map unmounts.
 */
export function useStoryMarkerMotion(options: StoryMarkerMotionOptions) {
  const { surface, reducedMotion, selectedId } = options;
  const slots = useMotionSlots<'reveal' | 'revealScope' | 'pulse' | 'draft' | 'ripple'>();
  const revealed = new Set<number>();
  let revealing: HTMLElement[] = [];
  let ripple: HTMLSpanElement | null = null;
  /** The next render shows every visible marker again (set when a filter narrowed the visible set). */
  let replayVisible = false;

  function hasRevealed(id: number) {
    return revealed.has(id);
  }

  function hasRevealedAny() {
    return revealed.size > 0;
  }

  function requestReplay(replay: boolean) {
    replayVisible = replay;
  }

  /** Whether a marker for these moments still waits for its reveal. */
  function isPending(ids: number[]) {
    return replayVisible || ids.some((id) => !revealed.has(id));
  }

  /** Called once a render has used the replay request to mark its markers pending. */
  function consumeReplay() {
    replayVisible = false;
  }

  function revealItems(visible: StoryMoment[], markerItems: StoryMarkerItem[], idFilter?: Set<number>): RevealItem[] {
    const momentById = new Map(visible.map((moment) => [moment.id, moment]));
    const markerItemByKey = new Map(markerItems.map((item) => [item.key, item]));
    const roots = Array.from(surface.value?.querySelectorAll<HTMLElement>('.story-marker:not(.story-marker--draft)') ?? []);
    const items = roots
      .map((root) => {
        const markerItem = root.dataset.storyMarkerKey ? markerItemByKey.get(root.dataset.storyMarkerKey) : null;
        const ids = markerItem?.moments.map((moment) => moment.id) ?? String(root.dataset.storyGroupIds ?? root.dataset.storyMotionId ?? '')
          .split(/\s+/)
          .map((value) => Number(value))
          .filter(Number.isFinite);
        const id = markerItem?.id ?? ids[0];
        const moment = markerItem?.representative ?? momentById.get(id);
        const visual = root.querySelector<HTMLElement>('.story-marker__visual');
        if (!moment || !visual || !Number.isFinite(id) || (idFilter && !ids.some((value) => idFilter.has(value)))) {
          return null;
        }
        return {
          id,
          ids,
          root,
          visual,
          glint: root.querySelector<HTMLElement>('.story-marker__glint'),
          pulse: root.querySelector<HTMLElement>('.story-marker__pulse')
        };
      })
      .filter((item): item is RevealItem => Boolean(item));
    const rank = new Map(sortStoryMomentsForReveal(visible, selectedId(), idFilter).map((moment, index) => [moment.id, index]));
    return items.sort((a, b) => Math.min(...a.ids.map((id) => rank.get(id) ?? 999)) - Math.min(...b.ids.map((id) => rank.get(id) ?? 999)));
  }

  function stopReveal() {
    slots.stop('reveal');
    if (revealing.length) {
      clearRevealClasses(revealing);
      revealing = [];
    }
  }

  /** Reveals markers that have not been shown yet, or the requested ones. */
  function reveal(visible: StoryMoment[], markerItems: StoryMarkerItem[], revealOptions: MarkerRevealOptions = {}): Promise<void> {
    const scope = surface.value;
    if (!scope || !visible.length) {
      return Promise.resolve();
    }

    const idFilter = revealOptions.ids ? new Set(revealOptions.ids) : undefined;
    const items = revealItems(visible, markerItems, idFilter).filter(
      (item) => revealOptions.replayVisible || idFilter || item.root.classList.contains('is-reveal-pending') || !revealed.has(item.id)
    );
    replayVisible = false;

    if (!items.length) {
      return Promise.resolve();
    }

    stopReveal();
    items.forEach((item) => {
      item.ids.forEach((id) => revealed.add(id));
      item.root.classList.remove('is-reveal-pending');
      item.root.classList.add('is-animating');
    });
    revealing = items.map((item) => item.root);

    const isMobile = revealOptions.isMobile ?? isMobileViewport();
    const present = <T>(values: Array<T | null>) => values.filter((value): value is T => Boolean(value));

    return new Promise<void>((resolve) => {
      slots.hold(
        'revealScope',
        gsap.context(() => {
          if (reducedMotion()) {
            gsap.set(present(items.flatMap((item) => [item.visual, item.glint, item.pulse])), {
              autoAlpha: 1,
              scale: 1,
              y: 0,
              rotation: 0,
              clearProps: 'transform,visibility'
            });
            gsap.set(present(items.flatMap((item) => [item.glint, item.pulse])), { autoAlpha: 0 });
            clearRevealClasses(items.map((item) => item.root));
            resolve();
            return;
          }

          const limit = fullRevealLimit(items.length, isMobile);
          const fullItems = items.slice(0, limit);
          const fadeItems = items.slice(limit);
          const fullVisuals = fullItems.map((item) => item.visual);
          const fullGlints = present(fullItems.map((item) => item.glint));
          const fullPulses = present(fullItems.map((item) => item.pulse));
          const fadeVisuals = fadeItems.map((item) => item.visual);
          const each = revealStagger(items.length, isMobile);
          const visualY = isMobile ? 4 : 8;
          const visualRotation = isMobile ? -0.6 : -1.8;
          const finish = () => {
            gsap.set([...fullVisuals, ...fadeVisuals], { clearProps: 'transform,visibility' });
            gsap.set([...fullGlints, ...fullPulses], { autoAlpha: 0, clearProps: 'transform,visibility' });
            clearRevealClasses(items.map((item) => item.root));
            revealing = [];
            resolve();
          };

          const enter = slots.hold('reveal', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' }, onComplete: finish }));

          if (fullGlints.length) {
            enter
              .fromTo(fullGlints, { autoAlpha: 0, scale: 0.35 }, { autoAlpha: 0.75, scale: 1, duration: isMobile ? 0.08 : 0.12, stagger: { each } }, 0)
              .to(fullGlints, { autoAlpha: 0, duration: isMobile ? 0.08 : 0.14, stagger: { each } }, isMobile ? 0.1 : 0.15);
          }

          if (fullPulses.length) {
            enter.fromTo(
              fullPulses,
              { autoAlpha: isMobile ? 0.22 : 0.32, scale: 0.65 },
              { autoAlpha: 0, scale: isMobile ? 1.62 : 2.05, duration: isMobile ? 0.22 : 0.34, stagger: { each } },
              isMobile ? 0.04 : 0.06
            );
          }

          if (fullVisuals.length) {
            enter
              .fromTo(
                fullVisuals,
                { autoAlpha: 0, scale: 0.4, y: visualY, rotation: visualRotation },
                {
                  autoAlpha: 1,
                  scale: isMobile ? 1.04 : 1.08,
                  y: isMobile ? 0 : -1,
                  rotation: isMobile ? 0.45 : 0.8,
                  duration: isMobile ? 0.18 : 0.24,
                  ease: 'back.out(1.18)',
                  stagger: { each }
                },
                isMobile ? 0.06 : 0.1
              )
              .to(
                fullVisuals,
                { scale: 1, y: 0, rotation: 0, duration: isMobile ? 0.12 : 0.18, ease: 'power2.inOut', stagger: { each } },
                isMobile ? 0.24 : 0.36
              );
          }

          if (fadeVisuals.length) {
            enter.fromTo(
              fadeVisuals,
              { autoAlpha: 0, scale: 0.88 },
              { autoAlpha: 1, scale: 1, duration: isMobile ? 0.12 : 0.18, stagger: { each: isMobile ? 0.01 : 0.018 } },
              fullVisuals.length ? (isMobile ? 0.18 : 0.26) : 0
            );
          }

          if (!enter.getChildren(false, true, true).length) {
            clearRevealClasses(items.map((item) => item.root));
            resolve();
          }
        }, scope)
      );
    });
  }

  /** Stops a reveal and the selection pulse, for example before markers are rebuilt. */
  function stopMarkers() {
    stopReveal();
    slots.stop('pulse');
  }

  function pulseSelected() {
    slots.stop('pulse');
    const id = selectedId();
    if (reducedMotion() || !surface.value || !id) {
      return;
    }
    const pulse = surface.value.querySelector<HTMLElement>(`[data-story-motion-id="${id}"] .story-marker__pulse`);
    const visual = surface.value.querySelector<HTMLElement>(`[data-story-motion-id="${id}"] .story-marker__visual`);
    if (!pulse) {
      return;
    }
    const timeline = slots.hold('pulse', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));
    if (visual) {
      timeline.fromTo(visual, { scale: 1 }, { scale: 1.08, duration: 0.16, yoyo: true, repeat: 1, clearProps: 'transform' }, 0);
    }
    timeline.fromTo(pulse, { autoAlpha: 0.38, scale: 0.75 }, { autoAlpha: 0, scale: 2.25, duration: 0.55, clearProps: 'transform,visibility' }, 0.04);
  }

  function popDraft() {
    slots.stop('draft');
    if (reducedMotion() || !surface.value) {
      return;
    }
    const draft = surface.value.querySelector<HTMLElement>('.story-marker--draft .story-marker__visual');
    if (draft) {
      slots.hold(
        'draft',
        gsap.fromTo(draft, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform,visibility' })
      );
    }
  }

  function removeRipple() {
    ripple?.remove();
    ripple = null;
  }

  /** A ripple where the map was clicked to create a moment. */
  function showRipple(anchor?: StoryEditorAnchor) {
    if (reducedMotion() || !surface.value || !anchor) {
      return;
    }

    slots.stop('ripple');
    removeRipple();

    const rect = surface.value.getBoundingClientRect();
    const element = document.createElement('span');
    element.className = 'story-map-ripple story-map-click-ripple';
    element.setAttribute('aria-hidden', 'true');
    element.style.left = `${anchor.x - rect.left}px`;
    element.style.top = `${anchor.y - rect.top}px`;
    surface.value.appendChild(element);
    ripple = element;

    slots.hold(
      'ripple',
      gsap.fromTo(
        element,
        { autoAlpha: 0.42, scale: 0.28 },
        {
          autoAlpha: 0,
          scale: 2.4,
          duration: 0.46,
          ease: 'power3.out',
          onComplete: () => {
            element.remove();
            if (ripple === element) {
              ripple = null;
            }
          }
        }
      )
    );
  }

  /** Stops everything; the map is going away. */
  function dispose() {
    stopReveal();
    slots.stopAll();
    removeRipple();
  }

  return {
    hasRevealed,
    hasRevealedAny,
    requestReplay,
    isPending,
    consumeReplay,
    reveal,
    stopMarkers,
    pulseSelected,
    popDraft,
    showRipple,
    dispose
  };
}
