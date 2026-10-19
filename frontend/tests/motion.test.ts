import { mount } from '@vue/test-utils';
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { createCloseOnce, useMotionSlots } from '../src/motion';

function mountWithSlots() {
  let slots!: ReturnType<typeof useMotionSlots<'a' | 'b'>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        slots = useMotionSlots<'a' | 'b'>();
        return () => h('div');
      }
    })
  );
  return { wrapper, slots: () => slots };
}

describe('useMotionSlots', () => {
  it('stops the animation a slot held when a new one takes its place', () => {
    const { slots } = mountWithSlots();
    const first = slots().hold('a', gsap.timeline().to({}, { duration: 10 }));
    const second = slots().hold('a', gsap.timeline().to({}, { duration: 10 }));

    expect(first.isActive()).toBe(false);
    expect(first.progress()).toBe(0);
    expect(second.paused()).toBe(false);
  });

  it('stops every held animation and reverts every held context when the component unmounts', () => {
    const { wrapper, slots } = mountWithSlots();
    const target = document.createElement('div');
    const timeline = slots().hold('a', gsap.timeline().to({}, { duration: 10 }));
    slots().hold(
      'b',
      gsap.context(() => {
        gsap.set(target, { opacity: 0.25 });
      })
    );
    expect(target.style.opacity).toBe('0.25');

    wrapper.unmount();

    expect(timeline.isActive()).toBe(false);
    expect(target.style.opacity).toBe('');
  });
});

describe('createCloseOnce', () => {
  it('returns the running close instead of starting a second one', async () => {
    const gate = createCloseOnce();
    let closes = 0;
    let finish!: () => void;
    const close = () => {
      closes += 1;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    };

    const first = gate.run(close);
    const second = gate.run(close);
    expect(second).toBe(first);
    expect(gate.closing).toBe(true);

    finish();
    await first;
    expect(closes).toBe(1);
    expect(gate.closing).toBe(false);
  });
});
