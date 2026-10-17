import type { StoryMoment } from '../model';

export const DEFAULT_STORY_MAP_CENTER = {
  longitude: 0,
  latitude: 0
};

type LocatedStoryMoment = StoryMoment & { longitude: number; latitude: number };

export interface StoryMarkerItem {
  key: string;
  kind: 'single' | 'group';
  id: number;
  moments: StoryMoment[];
  representative: StoryMoment;
  longitude: number;
  latitude: number;
  category: StoryMoment['category'];
  locationName: string;
  count: number;
}

export interface StoryMapTarget {
  center: {
    longitude: number;
    latitude: number;
  };
  zoom: number;
}

interface StoryMomentBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

const GROUP_NEAR_METERS = 60;
const GROUP_SAME_PLACE_METERS = 200;

export function hasStoryCoordinates(moment: StoryMoment): moment is LocatedStoryMoment {
  return Number.isFinite(moment.longitude) && Number.isFinite(moment.latitude);
}

export function buildStoryMarkerItems(items: StoryMoment[]): StoryMarkerItem[] {
  const groups: LocatedStoryMoment[][] = [];

  items.filter(hasStoryCoordinates).forEach((moment) => {
    const matchedGroups = groups.filter((group) =>
      group.some((groupMoment) => shouldGroupMoments(moment, groupMoment))
    );
    if (!matchedGroups.length) {
      groups.push([moment]);
      return;
    }

    const primaryGroup = matchedGroups[0];
    primaryGroup.push(moment);
    matchedGroups.slice(1).forEach((group) => {
      primaryGroup.push(...group);
      groups.splice(groups.indexOf(group), 1);
    });
  });

  return groups.map(createMarkerItem);
}

export function getStoryMapTarget(items: StoryMoment[], isMobile: boolean): StoryMapTarget {
  const visible = items.filter(hasStoryCoordinates);
  const bounds = getMomentBounds(visible);
  const center = bounds
    ? {
        longitude: (bounds.minLng + bounds.maxLng) / 2,
        latitude: (bounds.minLat + bounds.maxLat) / 2
      }
    : DEFAULT_STORY_MAP_CENTER;

  return {
    center,
    zoom: getTargetZoom(visible, isMobile, bounds)
  };
}

export function containsStoryMoment(
  item: StoryMarkerItem,
  id: number | null | undefined
): boolean {
  return typeof id === 'number' && item.moments.some((moment) => moment.id === id);
}

export function getLatestStoryMomentId(items: StoryMoment[]): number | null {
  return [...items].sort((left, right) => getStoryMomentTime(right) - getStoryMomentTime(left))[0]?.id ?? null;
}

export function getStoryMarkerRevealOrder(
  item: StoryMarkerItem,
  visible: StoryMarkerItem[],
  selectedId: number | null,
  ids?: Set<number>
): number {
  const order = sortStoryMomentsForReveal(
    visible.flatMap((markerItem) => markerItem.moments),
    selectedId,
    ids
  );
  const rank = new Map(order.map((moment, index) => [moment.id, index]));
  return Math.min(...item.moments.map((moment) => rank.get(moment.id) ?? 999));
}

export function sortStoryMomentsForReveal(
  visible: StoryMoment[],
  selectedId: number | null,
  ids?: Set<number>
): StoryMoment[] {
  const candidates = ids
    ? visible.filter((moment) => ids.has(moment.id))
    : [...visible];
  if (candidates.length <= 1) {
    return candidates;
  }

  const origin =
    candidates.find((moment) => moment.id === selectedId) ??
    [...candidates].sort(
      (left, right) => getStoryMomentTime(right) - getStoryMomentTime(left)
    )[0] ??
    null;

  return candidates.sort((left, right) => {
    if (origin) {
      if (left.id === origin.id) {
        return -1;
      }
      if (right.id === origin.id) {
        return 1;
      }
      const distanceDifference =
        getCoordinateDistance(left, origin) - getCoordinateDistance(right, origin);
      if (Math.abs(distanceDifference) > 0.000001) {
        return distanceDifference;
      }
    }
    return getStoryMomentTime(right) - getStoryMomentTime(left);
  });
}

export function getStoryFallbackPosition(
  item: StoryMarkerItem,
  points: StoryMarkerItem[]
): { left: string; top: string } {
  if (points.length <= 1) {
    return { left: '50%', top: '48%' };
  }
  const longitudes = points.map((markerItem) => markerItem.longitude);
  const latitudes = points.map((markerItem) => markerItem.latitude);
  const minLng = longitudes.length ? Math.min(...longitudes) : -1;
  const maxLng = longitudes.length ? Math.max(...longitudes) : 1;
  const minLat = latitudes.length ? Math.min(...latitudes) : -1;
  const maxLat = latitudes.length ? Math.max(...latitudes) : 1;
  const x = ((item.longitude - minLng) / Math.max(maxLng - minLng, 0.001)) * 74 + 13;
  const y = (1 - (item.latitude - minLat) / Math.max(maxLat - minLat, 0.001)) * 62 + 17;

  return {
    left: `${Math.min(90, Math.max(8, x))}%`,
    top: `${Math.min(78, Math.max(12, y))}%`
  };
}

export function formatStoryMomentShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function createMarkerItem(group: LocatedStoryMoment[]): StoryMarkerItem {
  const moments = [...group].sort(
    (left, right) => getStoryMomentTime(right) - getStoryMomentTime(left)
  );
  const representative = moments[0];
  const sortedIds = moments.map((moment) => moment.id).sort((left, right) => left - right);

  return {
    key: moments.length > 1 ? `group-${sortedIds.join('-')}` : `moment-${representative.id}`,
    kind: moments.length > 1 ? 'group' : 'single',
    id: representative.id,
    moments,
    representative,
    longitude: representative.longitude,
    latitude: representative.latitude,
    category: representative.category,
    locationName: representative.locationName,
    count: moments.length
  };
}

function shouldGroupMoments(left: LocatedStoryMoment, right: LocatedStoryMoment): boolean {
  const distance = getDistanceMeters(left, right);
  if (distance <= GROUP_NEAR_METERS) {
    return true;
  }
  return (
    left.locationName.trim() === right.locationName.trim() &&
    distance <= GROUP_SAME_PLACE_METERS
  );
}

function getDistanceMeters(left: LocatedStoryMoment, right: LocatedStoryMoment): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLng = toRadians(right.longitude - left.longitude);
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getMomentBounds(items: LocatedStoryMoment[]): StoryMomentBounds | null {
  if (!items.length) {
    return null;
  }
  return items.reduce(
    (bounds, item) => ({
      minLng: Math.min(bounds.minLng, item.longitude),
      maxLng: Math.max(bounds.maxLng, item.longitude),
      minLat: Math.min(bounds.minLat, item.latitude),
      maxLat: Math.max(bounds.maxLat, item.latitude)
    }),
    {
      minLng: items[0].longitude,
      maxLng: items[0].longitude,
      minLat: items[0].latitude,
      maxLat: items[0].latitude
    }
  );
}

function getTargetZoom(
  items: StoryMoment[],
  isMobile: boolean,
  bounds: StoryMomentBounds | null
): number {
  if (!items.length) {
    return 3;
  }
  if (items.length === 1 || !bounds) {
    return isMobile ? 11.8 : 12.8;
  }

  const span = Math.max(
    bounds.maxLng - bounds.minLng,
    bounds.maxLat - bounds.minLat
  );
  const baseZoom =
    span < 0.25
      ? 12.6
      : span < 0.8
        ? 11.5
        : span < 1.6
          ? 10.6
          : span < 3.2
            ? 9.6
            : 8.8;
  return clamp(
    isMobile ? baseZoom - 0.45 : baseZoom,
    isMobile ? 8.8 : 9.5,
    isMobile ? 12 : 13.2
  );
}

function getCoordinateDistance(moment: StoryMoment, origin: StoryMoment): number {
  if (!hasStoryCoordinates(moment) || !hasStoryCoordinates(origin)) {
    return Number.POSITIVE_INFINITY;
  }
  const longitude = moment.longitude - origin.longitude;
  const latitude = moment.latitude - origin.latitude;
  return longitude * longitude + latitude * latitude;
}

function getStoryMomentTime(moment: StoryMoment): number {
  const time = new Date(moment.eventTime).getTime();
  return Number.isFinite(time) ? time : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
