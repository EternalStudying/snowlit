import { vi } from 'vitest';
import type { AMapLngLat, AMapMapInstance } from '../../internal/amapSdk';

/**
 * The AMap 2.0 map surface the story map uses. Tests extend it and override what they observe.
 */
export class FakeAmapMap implements AMapMapInstance {
  constructor(_element?: HTMLElement, _options?: Record<string, unknown>) {}

  destroy: AMapMapInstance['destroy'] = vi.fn();
  on: AMapMapInstance['on'] = vi.fn();
  setFitView: AMapMapInstance['setFitView'] = vi.fn();
  setZoomAndCenter: AMapMapInstance['setZoomAndCenter'] = vi.fn();
  setZoom: AMapMapInstance['setZoom'] = vi.fn();
  setPitch: AMapMapInstance['setPitch'] = vi.fn();
  setRotation: AMapMapInstance['setRotation'] = vi.fn();
  getZoom: AMapMapInstance['getZoom'] = vi.fn(() => 10);
  getZooms: AMapMapInstance['getZooms'] = vi.fn((): [number, number] => [3, 20]);
  getCenter: () => AMapLngLat = vi.fn(() => ({ getLng: () => 4.81, getLat: () => 45.76 }));
}
