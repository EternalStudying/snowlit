import { nextTick, onBeforeUnmount, watch, type Ref, type WatchSource } from 'vue';
import { shouldSkipMotion } from '../../../motion';
import { EASE_SETTLE, ScrollTrigger, gsap, revealTitle } from '../../../motionKit';
import type { HomeOverview } from '../model';

// The page hand-off (App.vue) moves the page while it settles; scroll positions are measured after it.
const HAND_OFF_SETTLE_MS = 760;

// The photos rest in a fan and open out when the pointer comes near.
const PHOTO_FAN = [
  { x: -46, y: 18, rotation: -11 },
  { x: 40, y: 8, rotation: 9 },
  { x: 0, y: 0, rotation: -2 }
];
const PHOTO_SPREAD = [
  { x: -118, y: 30, rotation: -16 },
  { x: 116, y: 22, rotation: 15 },
  { x: 0, y: -18, rotation: 0 }
];

/**
 * Home's evening, built once the overview has rendered. Everything is a GSAP tween on transform or
 * opacity; nothing runs (and everything stays in its end state) when motion is skipped.
 */
export function useHomeEvening(root: Ref<HTMLElement | null>, overview: WatchSource<HomeOverview | null>) {
  let context: gsap.Context | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let built = false;
  let detachPhotos: (() => void) | undefined;

  function build() {
    const scope = root.value;
    if (!scope || built || shouldSkipMotion()) {
      return;
    }
    built = true;
    context = gsap.context(() => {
      const q = gsap.utils.selector(scope);

      q('.home-title').forEach((title) => {
        ScrollTrigger.create({ trigger: title, start: 'top 88%', once: true, onEnter: () => context?.add(() => revealTitle(title)) });
      });

      // Days: the cord draws itself, lanterns drop onto it and sway, then light one by one as the count climbs.
      const lanterns = q('.home-lantern');
      const number = q('.home-days__number')[0];
      const target = Number(number?.dataset.target ?? 0);
      const counter = { value: 0 };
      if (number) number.textContent = '0';
      gsap.from(q('.home-days__cord'), { drawSVG: '0%', duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: q('.home-days')[0], start: 'top 85%' } });
      gsap.from(lanterns, { y: -60, autoAlpha: 0, duration: 1, ease: EASE_SETTLE, stagger: 0.06, scrollTrigger: { trigger: q('.home-days')[0], start: 'top 80%' } });
      lanterns.forEach((lantern, index) => {
        gsap.to(lantern, { rotation: index % 2 ? 4 : -4, duration: 2.4 + (index % 4) * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: index * 0.2 });
      });
      gsap
        .timeline({ scrollTrigger: { trigger: q('.home-days')[0], start: 'top 75%', end: 'top 15%', scrub: 0.6 } })
        .to(counter, {
          value: target,
          duration: 1,
          ease: 'power1.out',
          onUpdate: () => {
            if (number) number.textContent = String(Math.round(counter.value));
          }
        }, 0)
        .fromTo(q('.home-lantern__glow'), { opacity: 0 }, { opacity: 1, duration: 0.12, stagger: 0.08 }, 0)
        .fromTo(number, { textShadow: '0 0 0px rgba(246, 180, 92, 0)' }, { textShadow: '0 0 38px rgba(246, 180, 92, 0.6)', duration: 0.3 }, 0.7);
      gsap.from(q('.home-days__lead, .home-days__quote, .home-days__since'), {
        y: 30, autoAlpha: 0, duration: 1, ease: EASE_SETTLE, stagger: 0.15,
        scrollTrigger: { trigger: q('.home-days')[0], start: 'top 65%' }
      });
      gsap.from(q('.home-days__tag'), {
        rotation: -30, y: -30, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.45)',
        scrollTrigger: { trigger: q('.home-days__tag')[0], start: 'top 92%' }
      });

      // Today: the paper screens of both windows slide open, the thread draws, the knot is tied.
      gsap
        .timeline({ scrollTrigger: { trigger: q('.home-today__windows')[0], start: 'top 72%' } })
        .fromTo(q('.home-window__shoji--l'), { xPercent: 0 }, { xPercent: -104, duration: 1.2, ease: 'power3.inOut', stagger: 0.25 }, 0)
        .fromTo(q('.home-window__shoji--r'), { xPercent: 0 }, { xPercent: 104, duration: 1.2, ease: 'power3.inOut', stagger: 0.25 }, 0)
        .from(q('.home-window__avatar'), { scale: 0.6, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.25 }, 0.6)
        .from(q('.home-window__lamp'), { rotation: -14, duration: 2, ease: 'elastic.out(1, 0.3)', stagger: 0.25 }, 0.5)
        .from(q('.home-window__tag'), { rotation: 8, y: -16, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.45)', stagger: 0.2 }, 0.8)
        .from(q('.home-thread__line'), { drawSVG: '0%', duration: 1.4, ease: 'power2.inOut' }, 0.9)
        .from(q('.home-thread__knot'), { scale: 0, transformOrigin: '50% 50%', duration: 0.7, ease: 'back.out(2.2)' }, 2)
        .from(q('.home-thread__tag'), { y: -14, autoAlpha: 0, duration: 0.6, ease: EASE_SETTLE }, 2.2);
      gsap.to(q('.home-window__steam'), { y: -3, autoAlpha: 0.4, duration: 1.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      // The letter unfolds, the stamp is pressed on, the postmark and seal land, the sprig draws in.
      gsap
        .timeline({ scrollTrigger: { trigger: q('.home-letter')[0], start: 'top 80%' } })
        .from(q('.home-letter'), { rotationX: -70, y: 40, autoAlpha: 0, transformPerspective: 900, transformOrigin: '50% 0%', duration: 1.3, ease: EASE_SETTLE })
        .from(q('.home-letter__tape'), { scaleX: 0, transformOrigin: '0% 50%', duration: 0.5, ease: 'power2.out' }, 0.5)
        .from(q('.home-letter__stamp'), { scale: 1.7, rotation: 12, autoAlpha: 0, duration: 0.45, ease: 'power3.in' }, 0.8)
        .from(q('.home-letter__postmark'), { autoAlpha: 0, scale: 1.2, duration: 0.3, ease: 'power2.out' }, 1.25)
        .from(q('.home-letter__branch'), { drawSVG: '0%', duration: 1.1, ease: 'power2.inOut' }, 1)
        .from(q('.home-letter__blossom'), { scale: 0, transformOrigin: '50% 50%', duration: 0.6, ease: 'back.out(2)', stagger: 0.12 }, 1.6)
        .from(q('.home-letter__seal'), { scale: 1.8, autoAlpha: 0, duration: 0.35, ease: 'power3.in' }, 1.9);

      // Recent: the diary and message settle onto the table, the photos fall into a fan.
      const photos = q('.home-photo');
      gsap.set(photos, { x: (i) => PHOTO_FAN[i].x, y: (i) => PHOTO_FAN[i].y, rotation: (i) => PHOTO_FAN[i].rotation });
      gsap.from(q('.home-notebook, .home-omikuji'), { y: 60, autoAlpha: 0, duration: 1.1, ease: EASE_SETTLE, stagger: 0.15, scrollTrigger: { trigger: q('.home-recent')[0], start: 'top 72%' } });
      gsap.from(photos, { y: -220, rotation: (i) => PHOTO_FAN[i].rotation * 3, autoAlpha: 0, duration: 1.2, ease: EASE_SETTLE, stagger: 0.14, scrollTrigger: { trigger: q('.home-recent')[0], start: 'top 70%' } });
      const album = q('.home-photos')[0];
      if (album) {
        const spread = () => gsap.to(photos, { x: (i) => PHOTO_SPREAD[i].x, y: (i) => PHOTO_SPREAD[i].y, rotation: (i) => PHOTO_SPREAD[i].rotation, duration: 0.7, ease: 'elastic.out(1, 0.7)', overwrite: 'auto' });
        const gather = () => gsap.to(photos, { x: (i) => PHOTO_FAN[i].x, y: (i) => PHOTO_FAN[i].y, rotation: (i) => PHOTO_FAN[i].rotation, duration: 0.7, ease: EASE_SETTLE, overwrite: 'auto' });
        album.addEventListener('pointerenter', spread);
        album.addEventListener('pointerleave', gather);
        album.addEventListener('focusin', spread);
        album.addEventListener('focusout', gather);
        detachPhotos = () => {
          album.removeEventListener('pointerenter', spread);
          album.removeEventListener('pointerleave', gather);
          album.removeEventListener('focusin', spread);
          album.removeEventListener('focusout', gather);
        };
      }

      // Next: the ema drops onto its cord and sways.
      gsap.from(q('.home-ema'), { y: -200, duration: 1.6, ease: 'elastic.out(1, 0.5)', scrollTrigger: { trigger: q('.home-next')[0], start: 'top 75%' } });
      gsap.to(q('.home-ema__board'), { rotation: 2.5, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }, scope);
    ScrollTrigger.refresh();
  }

  /** A push on the wish plaque; resolves once the swing has mostly settled. */
  function swingEma() {
    const board = root.value?.querySelector('.home-ema__board');
    if (!board || shouldSkipMotion()) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      gsap.fromTo(board, { rotation: -18 }, { rotation: 0, duration: 1.4, ease: 'elastic.out(1, 0.25)', overwrite: 'auto' });
      gsap.delayedCall(0.55, resolve);
    });
  }

  watch(
    overview,
    async (value) => {
      if (!value || built || shouldSkipMotion()) {
        return;
      }
      await nextTick();
      timer = setTimeout(build, HAND_OFF_SETTLE_MS);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    clearTimeout(timer);
    detachPhotos?.();
    context?.revert();
    context = null;
  });

  return { swingEma };
}
