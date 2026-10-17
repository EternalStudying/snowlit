import type { CloudGenus } from '../../profiles/skyProfiles';
import { WEATHER_CLOUD_BUDGET } from '../../core/weatherPerformanceBudget';

export { WEATHER_CLOUD_BUDGET };

export type CloudLayerProfile = {
  genus: CloudGenus;
  altitudeBand: 'low' | 'mid' | 'high' | 'towering';
  coverage: number;
  density: number;
  opacity: number;
  driftSpeed: number;
  morphSpeed: number;
  color: number;
};

const SHARED_DGHEZ_PROFILE = {
  coverage: 0.72,
  density: 0.68,
  opacity: 0.82,
  driftSpeed: 0.28,
  morphSpeed: 0.18,
  color: 0xf2f4f6
} as const;

export const CLOUD_LAYER_PROFILES: Record<CloudGenus, CloudLayerProfile> = {
  cumulus: {
    genus: 'cumulus',
    altitudeBand: 'low',
    ...SHARED_DGHEZ_PROFILE
  },
  stratus: {
    genus: 'stratus',
    altitudeBand: 'low',
    ...SHARED_DGHEZ_PROFILE
  },
  stratocumulus: {
    genus: 'stratocumulus',
    altitudeBand: 'low',
    ...SHARED_DGHEZ_PROFILE
  },
  cumulonimbus: {
    genus: 'cumulonimbus',
    altitudeBand: 'towering',
    ...SHARED_DGHEZ_PROFILE
  },
  altocumulus: {
    genus: 'altocumulus',
    altitudeBand: 'mid',
    ...SHARED_DGHEZ_PROFILE
  },
  altostratus: {
    genus: 'altostratus',
    altitudeBand: 'mid',
    ...SHARED_DGHEZ_PROFILE
  },
  nimbostratus: {
    genus: 'nimbostratus',
    altitudeBand: 'mid',
    ...SHARED_DGHEZ_PROFILE
  },
  cirrus: {
    genus: 'cirrus',
    altitudeBand: 'high',
    ...SHARED_DGHEZ_PROFILE
  },
  cirrostratus: {
    genus: 'cirrostratus',
    altitudeBand: 'high',
    ...SHARED_DGHEZ_PROFILE
  },
  cirrocumulus: {
    genus: 'cirrocumulus',
    altitudeBand: 'high',
    ...SHARED_DGHEZ_PROFILE
  }
};

export function getCloudLayerProfile(genus: CloudGenus): CloudLayerProfile {
  return CLOUD_LAYER_PROFILES[genus];
}
