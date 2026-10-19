import { onBeforeUnmount } from 'vue';
import { readAmapCoordinate, type AMapMapInstance } from './amapSdk';
import type { StoryMapTarget } from './storyMapModel';

const WHEEL_ZOOM_STEP = 0.22;
const WHEEL_ZOOM_MAX_DELTA = 0.72;
const WHEEL_ZOOM_DURATION = 120;

type Coordinates = { longitude: number; latitude: number };

export interface StoryMapCameraOptions {
  reducedMotion: () => boolean;
  /** Wheel zoom only acts while the real map is showing. */
  mapReady: () => boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * The Story map camera: where it looks (zoom, centre, pitch, rotation), the slow fly-in when the page enters,
 * and smooth wheel zoom. It wraps the AMap instance it is attached to and lets go of everything on unmount.
 */
export function useStoryMapCamera(options: StoryMapCameraOptions) {
  const { reducedMotion, mapReady } = options;
  let map: AMapMapInstance | null = null;
  let wheelElement: HTMLElement | null = null;
  let wheelFrame: number | null = null;
  let pendingWheelDelta = 0;
  let wheelTargetZoom: number | null = null;
  let flightTimer: ReturnType<typeof window.setTimeout> | null = null;

  /** Starts driving this map; the wheel over `surface` zooms it smoothly. */
  function attach(instance: AMapMapInstance, surface: HTMLElement) {
    map = instance;
    detachWheel();
    surface.addEventListener('wheel', handleWheel, { passive: false });
    wheelElement = surface;
  }

  function setCenterZoom(zoom: number, center: Coordinates, immediate: boolean, duration?: number) {
    wheelTargetZoom = null;
    map?.setZoomAndCenter(zoom, [center.longitude, center.latitude], immediate, duration);
  }

  function setPitch(value: number, immediate: boolean, duration?: number) {
    map?.setPitch(value, immediate, duration);
  }

  function setRotation(value: number, immediate: boolean, duration?: number) {
    map?.setRotation(value, immediate, duration);
  }

  /** Where the camera is now, or `fallback` without a map. */
  function readTarget(fallback: StoryMapTarget): StoryMapTarget {
    if (!map) {
      return fallback;
    }
    return { center: readAmapCoordinate(map.getCenter()) ?? fallback.center, zoom: map.getZoom() };
  }

  /** The start and end pose of the entry flight towards `target`. */
  function entryPose(target: StoryMapTarget, isMobile: boolean) {
    return {
      center: target.center,
      startZoom: Math.max(isMobile ? 5.8 : 4.8, target.zoom - (isMobile ? 2.1 : 3)),
      targetZoom: target.zoom,
      startPitch: isMobile ? 7 : 20,
      targetPitch: isMobile ? 0 : 8,
      startRotation: isMobile ? 0 : -4,
      targetRotation: 0
    };
  }

  function showStart(target: StoryMapTarget, isMobile: boolean) {
    const pose = entryPose(target, isMobile);
    setPitch(pose.startPitch, true);
    setRotation(pose.startRotation, true);
    setCenterZoom(pose.startZoom, pose.center, true);
  }

  function showEnd(target: StoryMapTarget, isMobile: boolean) {
    const pose = entryPose(target, isMobile);
    setPitch(pose.targetPitch, true);
    setRotation(pose.targetRotation, true);
    setCenterZoom(pose.targetZoom, pose.center, true);
  }

  /** Puts the camera at the start of the entry flight, ready to fly in. */
  function prepareEntry(target: StoryMapTarget, isMobile: boolean) {
    if (!map) {
      return false;
    }
    showStart(target, isMobile);
    return true;
  }

  /** Flies from the start pose to `target`; `onLanded` settles the final view. */
  function flyIn(target: StoryMapTarget, isMobile: boolean, onLanded: () => void): Promise<boolean> {
    if (!map) {
      return Promise.resolve(false);
    }
    cancelFlight();

    if (reducedMotion()) {
      showEnd(target, isMobile);
      onLanded();
      return Promise.resolve(true);
    }

    const pose = entryPose(target, isMobile);
    const duration = isMobile ? 1550 : 2120;
    showStart(target, isMobile);
    window.requestAnimationFrame(() => {
      setPitch(pose.targetPitch, false, duration);
      setRotation(pose.targetRotation, false, duration);
      setCenterZoom(pose.targetZoom, pose.center, false, duration);
    });

    return new Promise<boolean>((resolve) => {
      flightTimer = window.setTimeout(() => {
        flightTimer = null;
        showEnd(target, isMobile);
        onLanded();
        resolve(true);
      }, duration + 120);
    });
  }

  function cancelFlight() {
    if (flightTimer) {
      window.clearTimeout(flightTimer);
      flightTimer = null;
    }
  }

  function handleWheel(event: WheelEvent) {
    if (!map || !mapReady()) {
      return;
    }
    event.preventDefault();

    const modeScale = event.deltaMode === 1 ? 36 : event.deltaMode === 2 ? 240 : 1;
    const delta = event.deltaY * modeScale;
    const step = (delta > 0 ? -1 : 1) * WHEEL_ZOOM_STEP * clamp(Math.abs(delta) / 100, 0.72, 1.18);
    pendingWheelDelta = clamp(pendingWheelDelta + step, -WHEEL_ZOOM_MAX_DELTA, WHEEL_ZOOM_MAX_DELTA);

    if (wheelFrame === null) {
      wheelFrame = window.requestAnimationFrame(flushWheel);
    }
  }

  function flushWheel() {
    wheelFrame = null;
    if (!map || Math.abs(pendingWheelDelta) < 0.001) {
      pendingWheelDelta = 0;
      return;
    }

    const [min, max] = map.getZooms();
    const zoom = clamp((wheelTargetZoom ?? map.getZoom(2)) + pendingWheelDelta, min, max);
    pendingWheelDelta = 0;
    wheelTargetZoom = zoom;
    map.setZoom(zoom, reducedMotion(), reducedMotion() ? 0 : WHEEL_ZOOM_DURATION);
  }

  function detachWheel() {
    wheelElement?.removeEventListener('wheel', handleWheel);
    wheelElement = null;
    if (wheelFrame !== null) {
      window.cancelAnimationFrame(wheelFrame);
      wheelFrame = null;
    }
    pendingWheelDelta = 0;
    wheelTargetZoom = null;
  }

  function dispose() {
    detachWheel();
    cancelFlight();
    map = null;
  }

  onBeforeUnmount(dispose);

  return { attach, setCenterZoom, setPitch, setRotation, readTarget, prepareEntry, flyIn, showEnd, dispose };
}
