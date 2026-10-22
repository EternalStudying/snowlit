import { nextTick, onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue';
import { shouldSkipMotion } from '../../../motion';
import { EASE_LIFT, EASE_SETTLE, ScrollTrigger, gsap, hasFinePointer, revealTitle, settleOnScroll } from '../../../motionKit';
import type { HomeOverview } from '../model';

// The page hand-off (App.vue) moves the page while it settles; pinning must wait until it has finished.
const HAND_OFF_SETTLE_MS = 760;

/**
 * Home's choreography, built once the overview has rendered:
 * - wide screens pin the "days" chapter while the thread draws through its four stops and the quote rises;
 * - narrow screens play the same chapter once, unpinned;
 * - section titles rise character by character as they arrive, cards settle in batches;
 * - the recent cards fan out when the pointer comes near, and the next wish's tick draws itself.
 * Everything is reverted on unmount; nothing runs when motion is skipped.
 */
export function useHomeStory(root: Ref<HTMLElement | null>, overview: WatchSource<HomeOverview | null>) {
  let media: gsap.MatchMedia | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let built = false;

  function build() {
    const scope = root.value;
    if (!scope || built || shouldSkipMotion()) {
      return;
    }
    built = true;
    media = gsap.matchMedia(scope);

    media.add(
      {
        wide: '(min-width: 900px) and (min-height: 620px)',
        narrow: '(max-width: 899px), (max-height: 619px)'
      },
      (context) => {
        const { wide } = context.conditions as { wide: boolean; narrow: boolean };
        const q = gsap.utils.selector(scope);
        const stops = q('.home-stop');
        const path = q('.home-thread__path');

        gsap.set(stops, { autoAlpha: 0.22, y: 14 });
        gsap.set(q('.home-days__quote-line'), { yPercent: 110, autoAlpha: 0 });

        const chapter = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: wide
            ? { trigger: q('.home-days')[0], start: 'top top', end: '+=120%', pin: true, scrub: 0.8, anticipatePin: 1 }
            : { trigger: q('.home-days')[0], start: 'top 70%', toggleActions: 'play none none none' }
        });
        chapter
          .to(q('.home-days__quote-line'), { yPercent: 0, autoAlpha: 1, stagger: 0.12, duration: 0.3, ease: EASE_SETTLE }, 0)
          .fromTo(path, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 1 }, 0.1);
        stops.forEach((stop, index) => {
          chapter.to(stop, { autoAlpha: 1, y: 0, duration: 0.18, ease: EASE_SETTLE }, 0.1 + (index / Math.max(1, stops.length - 1)) * 0.92);
        });
        if (!wide) {
          chapter.duration(2.2);
        }

        q('.home-section-title').forEach((title) => {
          ScrollTrigger.create({ trigger: title, start: 'top 88%', once: true, onEnter: () => context.add(() => revealTitle(title)) });
        });

        settleOnScroll(q('.daily-note-card, .status-person-card, .distance-ribbon, .next-plan-strip'));
        gsap.from(q('.daily-note-card__tape'), {
          y: -40,
          rotate: -18,
          autoAlpha: 0,
          duration: 0.9,
          ease: EASE_LIFT,
          scrollTrigger: { trigger: q('.daily-note-card')[0], start: 'top 85%' }
        });

        const tick = q('.next-plan-strip__tick');
        gsap.fromTo(tick, { drawSVG: '0% 0%' }, {
          drawSVG: '0% 100%',
          duration: 0.7,
          delay: 0.35,
          ease: 'power2.out',
          scrollTrigger: { trigger: q('.next-plan-strip')[0], start: 'top 85%' }
        });

        return buildFan(q('.recent-fan')[0], q('.recent-paper-item'), wide);
      }
    );
  }

  /** On wide screens the three recent cards rest as a fan and spread apart when the pointer comes near. */
  function buildFan(fan: Element | undefined, cards: Element[], wide: boolean): (() => void) | undefined {
    if (!fan || cards.length !== 3 || !wide) {
      settleOnScroll(cards);
      return undefined;
    }
    const rest = [
      { x: '34%', rotate: -7, y: 18 },
      { x: '0%', rotate: 0, y: 0 },
      { x: '-34%', rotate: 7, y: 18 }
    ];
    gsap.set(cards, { transformOrigin: '50% 120%' });
    gsap.from(cards, {
      y: 120,
      autoAlpha: 0,
      rotate: (index) => [-16, 0, 16][index],
      duration: 1,
      ease: EASE_SETTLE,
      stagger: 0.1,
      scrollTrigger: { trigger: fan, start: 'top 80%' },
      onComplete: () => {
        gsap.to(cards, { x: (i) => rest[i].x, rotate: (i) => rest[i].rotate, y: (i) => rest[i].y, duration: 0.8, ease: EASE_LIFT });
      }
    });
    if (!hasFinePointer()) {
      return undefined;
    }
    const spread = () => gsap.to(cards, { x: 0, rotate: 0, y: 0, duration: 0.7, ease: EASE_LIFT, overwrite: 'auto' });
    const gather = () =>
      gsap.to(cards, { x: (i) => rest[i].x, rotate: (i) => rest[i].rotate, y: (i) => rest[i].y, duration: 0.8, ease: EASE_LIFT, overwrite: 'auto' });
    fan.addEventListener('pointerenter', spread);
    fan.addEventListener('pointerleave', gather);
    fan.addEventListener('focusin', spread);
    fan.addEventListener('focusout', gather);
    return () => {
      fan.removeEventListener('pointerenter', spread);
      fan.removeEventListener('pointerleave', gather);
      fan.removeEventListener('focusin', spread);
      fan.removeEventListener('focusout', gather);
    };
  }

  watch(
    overview,
    async (value) => {
      if (!value || built || shouldSkipMotion()) {
        return;
      }
      await nextTick();
      timer = setTimeout(() => {
        build();
        ScrollTrigger.refresh();
      }, HAND_OFF_SETTLE_MS);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    clearTimeout(timer);
    media?.revert();
    media = null;
  });
}
