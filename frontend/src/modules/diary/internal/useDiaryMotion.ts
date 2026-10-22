import { onBeforeUnmount, type Ref } from 'vue';
import { shouldSkipMotion } from '../../../motion';
import { EASE_LIFT, EASE_SETTLE, ScrollTrigger, gsap, revealTitle } from '../../../motionKit';

/**
 * The diary's GSAP moments. The cards themselves keep their CSS placement (driven by the visibility
 * observer in DiaryView); this adds what CSS cannot sequence:
 * - each month page writes its title character by character;
 * - as a day scrolls into view its date point lights up on the spine and the date slides out beside it;
 * - opening the year chapters deals the month tabs in one after another;
 * - a newly chosen mood face squashes and pops.
 * Every call is a no-op when motion is skipped.
 */
export function useDiaryMotion(timeline: Ref<HTMLElement | null>) {
  let monthContext: gsap.Context | null = null;

  function playMonth() {
    const root = timeline.value;
    monthContext?.revert();
    monthContext = null;
    if (!root || shouldSkipMotion()) {
      return;
    }
    monthContext = gsap.context(() => {
      revealTitle(root.querySelector('.diary-current-month'), 0.05);

      const rows = gsap.utils.toArray<HTMLElement>('.diary-date-row', root);
      gsap.set(rows.map((row) => row.querySelector('.diary-date-point')), { scale: 0, autoAlpha: 0 });
      gsap.set(rows.map((row) => row.querySelectorAll('.diary-date-point__label, .diary-date-point__weekday')), {
        autoAlpha: 0,
        y: 10
      });
      ScrollTrigger.batch(rows, {
        start: 'top 86%',
        once: true,
        onEnter: (batch) => {
          const points = batch.map((row) => row.querySelector('.diary-date-point'));
          const labels = batch.flatMap((row) => Array.from(row.querySelectorAll('.diary-date-point__label, .diary-date-point__weekday')));
          gsap.to(points, { scale: 1, autoAlpha: 1, duration: 0.6, ease: EASE_LIFT, stagger: 0.08 });
          gsap.to(labels, { autoAlpha: 1, y: 0, duration: 0.5, ease: EASE_SETTLE, stagger: 0.05, delay: 0.1 });
        }
      });
    }, root);
  }

  function dealChapters(panel: Element | null) {
    if (!panel || shouldSkipMotion()) {
      return;
    }
    gsap.from(panel.querySelectorAll('.diary-year-chapter h3, .diary-month-chapter__button'), {
      autoAlpha: 0,
      y: 14,
      rotate: (index) => (index % 2 ? 2 : -2),
      duration: 0.42,
      ease: EASE_SETTLE,
      stagger: 0.018,
      clearProps: 'opacity,visibility,transform'
    });
  }

  onBeforeUnmount(() => {
    monthContext?.revert();
    monthContext = null;
  });

  return { playMonth, dealChapters };
}

/** A chosen mood face squashes, then pops back with a small overshoot. */
export function popMoodFace(face: Element | null) {
  if (!face || shouldSkipMotion()) {
    return;
  }
  gsap.fromTo(
    face,
    { scaleX: 1.18, scaleY: 0.78, rotate: -8 },
    { scaleX: 1, scaleY: 1, rotate: 0, duration: 0.62, ease: 'elastic.out(1, 0.45)', overwrite: true }
  );
}
