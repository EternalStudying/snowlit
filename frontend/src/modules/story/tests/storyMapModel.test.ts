import { describe, expect, it } from 'vitest';
import type { StoryMoment } from '../model';
import {
  buildStoryMarkerItems,
  containsStoryMoment,
  getLatestStoryMomentId,
  getStoryFallbackPosition,
  getStoryMapTarget,
  getStoryMarkerRevealOrder,
  sortStoryMomentsForReveal
} from '../internal/storyMapModel';

function createMoment(
  id: number,
  overrides: Partial<StoryMoment> = {}
): StoryMoment {
  return {
    id,
    title: `点滴 ${id}`,
    content: '',
    eventTime: `2026-05-${String(id).padStart(2, '0')}T12:00:00`,
    endTime: null,
    locationName: `地点 ${id}`,
    address: '',
    longitude: 2.29 + id * 0.01,
    latitude: 48.86 + id * 0.01,
    category: 'daily',
    images: [],
    createdByUserId: 1,
    createdAt: '2026-05-01T12:00:00',
    updatedAt: '2026-05-01T12:00:00',
    ...overrides
  };
}

describe('Story map model', () => {
  it('omits unlocated samples from the map while retaining real zero coordinates', () => {
    const sample = createMoment(1, { longitude: null, latitude: null });
    expect(buildStoryMarkerItems([sample])).toEqual([]);
    expect(getStoryMapTarget([sample], true)).toEqual({center: {longitude: 0, latitude: 0}, zoom: 3});
    const zero = createMoment(2, { longitude: 0, latitude: 0 });
    expect(buildStoryMarkerItems([sample, zero])).toHaveLength(1);
    const markers = buildStoryMarkerItems([zero]);
    expect(getStoryFallbackPosition(markers[0], markers)).toEqual({left: '50%', top: '48%'});
    expect(getStoryMapTarget([zero], false).center).toEqual({longitude: 0, latitude: 0});
  });

  it('groups nearby moments and same-place moments behind one marker', () => {
    const near = createMoment(1, {
      locationName: '第一中学',
      longitude: 2.29,
      latitude: 48.86
    });
    const samePlace = createMoment(2, {
      locationName: ' 第一中学 ',
      longitude: 2.291,
      latitude: 48.86
    });
    const separate = createMoment(3, {
      locationName: '另一地点',
      longitude: 6.15,
      latitude: 46.21
    });

    const markers = buildStoryMarkerItems([near, samePlace, separate]);

    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      key: 'group-1-2',
      kind: 'group',
      count: 2,
      id: 2
    });
    expect(markers[0].moments.map((moment) => moment.id)).toEqual([2, 1]);
    expect(containsStoryMoment(markers[0], 1)).toBe(true);
    expect(containsStoryMoment(markers[0], 3)).toBe(false);
  });

  it('calculates deterministic camera targets for empty, single, and distributed data', () => {
    expect(getStoryMapTarget([], false)).toEqual({
      center: { longitude: 0, latitude: 0 },
      zoom: 3
    });

    const single = createMoment(1, { longitude: 6.15, latitude: 46.21 });
    expect(getStoryMapTarget([single], true)).toEqual({
      center: { longitude: 6.15, latitude: 46.21 },
      zoom: 11.8
    });

    const distributed = createMoment(2, { longitude: 8.15, latitude: 47.21 });
    const target = getStoryMapTarget([single, distributed], false);
    expect(target.center).toEqual({ longitude: 7.15, latitude: 46.71 });
    expect(target.zoom).toBe(9.6);
  });

  it('orders marker reveal from the selection, then by coordinate distance', () => {
    const selected = createMoment(1, { longitude: 5, latitude: 46 });
    const nearest = createMoment(2, { longitude: 5.01, latitude: 46.01 });
    const furthest = createMoment(3, { longitude: 6, latitude: 47 });
    const ordered = sortStoryMomentsForReveal(
      [furthest, nearest, selected],
      selected.id
    );
    const markers = buildStoryMarkerItems([furthest, nearest, selected]);
    const furthestMarker = markers.find((item) => item.id === furthest.id);

    expect(ordered.map((moment) => moment.id)).toEqual([1, 2, 3]);
    expect(getLatestStoryMomentId([selected, nearest, furthest])).toBe(3);
    expect(furthestMarker).toBeDefined();
    expect(
      getStoryMarkerRevealOrder(furthestMarker!, markers, selected.id)
    ).toBe(2);
  });

  it('projects fallback markers into bounded percentage coordinates', () => {
    const markers = buildStoryMarkerItems([
      createMoment(1, { longitude: 5, latitude: 40 }),
      createMoment(2, { longitude: 15, latitude: 50 })
    ]);

    const firstPosition = getStoryFallbackPosition(markers[0], markers);
    const secondPosition = getStoryFallbackPosition(markers[1], markers);

    expect(firstPosition).toEqual({ left: '13%', top: '78%' });
    expect(secondPosition).toEqual({ left: '87%', top: '17%' });
  });
});
