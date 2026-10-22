import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { shouldSkipMotion } from '../motion';
import { gsap } from '../motionKit';

/**
 * As the page scrolls past the hero, the painting sinks a little slower than the page and the couple
 * stickers fade, so the cover recedes instead of simply scrolling away. Only the slides container moves:
 * the stickers' own transforms belong to the hero expand interaction.
 */
export function useHeroParallax(shell: Ref<HTMLElement | null>) {
  let media: gsap.MatchMedia | null = null;

  onMounted(() => {
    const root = shell.value;
    if (!root || shouldSkipMotion()) {
      return;
    }
    media = gsap.matchMedia(root);
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const hero = root.querySelector('.journal-hero-carousel');
      if (!hero) {
        return;
      }
      const scrub = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(root.querySelector('.journal-hero-slides'), { yPercent: 16, ease: 'none', scrollTrigger: scrub });
      gsap.to(root.querySelector('.journal-hero-content'), { opacity: 0.15, ease: 'power1.in', scrollTrigger: { ...scrub } });
    });
  });

  onBeforeUnmount(() => {
    media?.revert();
    media = null;
  });
}
