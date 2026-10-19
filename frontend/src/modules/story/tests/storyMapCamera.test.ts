import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { useStoryMapCamera } from '../internal/useStoryMapCamera';
import { FakeAmapMap } from './support/fakeAmapMap';

const target = { center: { longitude: 4.8, latitude: 45.7 }, zoom: 11 };

function mountCamera(reducedMotion = false) {
  let camera!: ReturnType<typeof useStoryMapCamera>;
  const wrapper = mount(
    defineComponent({
      setup() {
        camera = useStoryMapCamera({ reducedMotion: () => reducedMotion, mapReady: () => true });
        return () => h('div');
      }
    })
  );
  const map = new FakeAmapMap();
  const surface = document.createElement('div');
  camera.attach(map, surface);
  return { wrapper, camera, map, surface };
}

function wheel(surface: HTMLElement, deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true });
  surface.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Story map camera', () => {
  it('turns a burst of wheel ticks into one smooth zoom step per frame, within the map limits', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
    const { map, surface } = mountCamera();

    const event = wheel(surface, -100);
    wheel(surface, -100);
    expect(event.defaultPrevented).toBe(true);
    expect(frames).toHaveLength(1);

    frames[0](0);
    expect(map.setZoom).toHaveBeenCalledTimes(1);
    const [zoom, immediate, duration] = vi.mocked(map.setZoom).mock.calls[0];
    expect(zoom).toBeCloseTo(10.44);
    expect(immediate).toBe(false);
    expect(duration).toBe(120);
  });

  it('stops listening to the wheel when its component unmounts', () => {
    const { wrapper, map, surface } = mountCamera();
    wrapper.unmount();

    expect(wheel(surface, -100).defaultPrevented).toBe(false);
    expect(map.setZoom).not.toHaveBeenCalled();
  });

  it('flies from a wider, tilted start to the target and then lets the caller settle the view', async () => {
    vi.useFakeTimers();
    const { camera, map } = mountCamera();
    const landed = vi.fn();

    const flight = camera.flyIn(target, false, landed);
    expect(map.setZoomAndCenter).toHaveBeenLastCalledWith(8, [4.8, 45.7], true, undefined);
    expect(map.setPitch).toHaveBeenLastCalledWith(20, true, undefined);

    vi.advanceTimersByTime(2240);
    await expect(flight).resolves.toBe(true);
    expect(map.setZoomAndCenter).toHaveBeenLastCalledWith(11, [4.8, 45.7], true, undefined);
    expect(landed).toHaveBeenCalledTimes(1);
  });

  it('jumps straight to the target with reduced motion', async () => {
    const { camera, map } = mountCamera(true);
    const landed = vi.fn();

    await expect(camera.flyIn(target, false, landed)).resolves.toBe(true);
    expect(map.setZoomAndCenter).toHaveBeenCalledTimes(1);
    expect(map.setZoomAndCenter).toHaveBeenCalledWith(11, [4.8, 45.7], true, undefined);
    expect(landed).toHaveBeenCalledTimes(1);
  });
});
