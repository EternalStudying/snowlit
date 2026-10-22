import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { shouldSkipMotion } from '../../motion';
import { EASE_SETTLE, ScrollTrigger, gsap } from '../../motionKit';

type EveningWorldElements = {
  shell: Ref<HTMLElement | null>;
  cover: Ref<HTMLElement | null>;
  board: Ref<HTMLElement | null>;
  isEvening: Readonly<Ref<boolean>>;
};

const PAINTING_HOLD_MS = 8000;

/**
 * The shell's motion. Nothing here measures layout on scroll: the plaque docks with position: sticky and
 * every scroll-linked effect is a GSAP scrub on transform or opacity.
 * - the cover paintings take turns, each slowly drifting closer, and sink as the page scrolls past;
 * - the plaque's cords pull in as it reaches the top, and the body is marked docked for the top bar;
 * - a lantern slides behind the current page's link;
 * - on evening pages the sky darkens from dusk to night over the length of the page.
 */
export function useEveningWorld({ shell, cover, board, isEvening }: EveningWorldElements) {
  let context: gsap.Context | null = null;
  let skyContext: gsap.Context | null = null;
  let paintingTimer: ReturnType<typeof setInterval> | undefined;

  function activeLink() {
    return board.value?.querySelector<HTMLElement>('.snow-plaque__link.is-active') ?? null;
  }

  function moveLantern(instant = false) {
    const boardElement = board.value;
    const lantern = boardElement?.querySelector<HTMLElement>('.snow-plaque__lantern');
    if (!boardElement || !lantern) {
      return;
    }
    const link = activeLink();
    if (!link) {
      gsap.to(lantern, { autoAlpha: 0, duration: instant ? 0 : 0.2 });
      return;
    }
    const boardRect = boardElement.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    gsap.to(lantern, {
      autoAlpha: 1,
      x: rect.left - boardRect.left,
      width: rect.width,
      duration: instant || shouldSkipMotion() ? 0 : 0.6,
      ease: 'elastic.out(1, 0.75)',
      overwrite: true
    });
  }

  function beatHeart(heart: HTMLElement | null) {
    if (!heart || shouldSkipMotion()) {
      return;
    }
    gsap.fromTo(heart, { scale: 0.78 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)', overwrite: 'auto' });
  }

  function buildSky() {
    skyContext?.revert();
    skyContext = null;
    const root = shell.value;
    if (!root || !isEvening.value) {
      return;
    }
    skyContext = gsap.context(() => {
      if (shouldSkipMotion()) {
        gsap.set('.snow-sky__wash--late', { opacity: 1 });
        return;
      }
      const scrub = (start: string, end: string) => ({ trigger: root, start, end, scrub: true });
      gsap.to('.snow-sky__wash--late', { opacity: 1, ease: 'none', scrollTrigger: scrub('top+=40% top', 'top+=55% top') });
      gsap.to('.snow-sky__wash--night', { opacity: 1, ease: 'none', scrollTrigger: scrub('top+=58% top', 'bottom bottom') });
    }, root);
  }

  onMounted(() => {
    const root = shell.value;
    if (!root) {
      return;
    }
    document.fonts?.ready.then(() => moveLantern(true));
    moveLantern(true);
    window.addEventListener('resize', onResize);

    context = gsap.context(() => {
      const docked = ScrollTrigger.create({
        trigger: cover.value,
        start: 'bottom 72px',
        end: 'max',
        onToggle: (self) => document.body.classList.toggle('is-plaque-docked', self.isActive)
      });
      document.body.classList.toggle('is-plaque-docked', docked.isActive);

      if (shouldSkipMotion()) {
        return;
      }

      const paintings = gsap.utils.toArray<HTMLElement>('.snow-cover__painting');
      gsap.from('.snow-cover__frame', { scale: 1.04, duration: 2.2, ease: EASE_SETTLE });
      gsap.from('.snow-cover__person, .snow-cover__heart', { y: 40, autoAlpha: 0, duration: 1.1, ease: EASE_SETTLE, stagger: 0.12, delay: 0.4 });
      gsap.to('.snow-cover__heart', { scale: 1.08, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      if (paintings.length > 1) {
        let current = 0;
        const drift = (image: HTMLElement) => gsap.fromTo(image, { scale: 1.08 }, { scale: 1, duration: 9, ease: 'none' });
        drift(paintings[0]);
        paintingTimer = setInterval(() => {
          const next = (current + 1) % paintings.length;
          gsap.to(paintings[current], { opacity: 0, duration: 1.6, ease: 'power1.inOut' });
          gsap.to(paintings[next], { opacity: 1, duration: 1.6, ease: 'power1.inOut' });
          drift(paintings[next]);
          current = next;
        }, PAINTING_HOLD_MS);
      }

      gsap.to('.snow-cover__couple', {
        yPercent: -40,
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: cover.value, start: 'top top', end: 'bottom 30%', scrub: true }
      });
      gsap.to('.snow-cover__frame', {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: { trigger: cover.value, start: 'top top', end: 'bottom top', scrub: true }
      });
      const dock = { trigger: cover.value, start: 'bottom 170px', end: 'bottom 60px', scrub: true };
      gsap.to('.snow-plaque__cord', { scaleY: 0, ease: 'none', scrollTrigger: dock });
      gsap.to('.snow-plaque__board', { scale: 0.92, ease: 'none', scrollTrigger: { ...dock } });
    }, root);

    void nextTick(buildSky);
  });

  function onResize() {
    moveLantern(true);
  }

  watch(isEvening, () => void nextTick(buildSky));

  onBeforeUnmount(() => {
    clearInterval(paintingTimer);
    window.removeEventListener('resize', onResize);
    skyContext?.revert();
    context?.revert();
    document.body.classList.remove('is-plaque-docked');
  });

  return { moveLantern, beatHeart };
}
