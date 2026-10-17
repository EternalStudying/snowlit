export const WEATHER_PIXEL_RATIO_CAP = 2;

export const WEATHER_PARTICLE_COUNTS = {
  rain: 30000,
  snow: {
    lightSnow: 10000,
    snow: 18000,
    blizzard: 28000
  },
  hail: {
    hail: 1600,
    hailStorm: 3200
  },
  sand: {
    dust: 12000,
    sandstorm: 15000
  },
  rainSplash: 320,
  sunnyDust: 900,
  auroraStars: 420
} as const;

export const WEATHER_LIGHTNING_BUDGET = {
  maxActiveBolts: 3
} as const;

export const WEATHER_METEOR_BUDGET = {
  maxActiveMeteors: 4,
  maxRenderableMeshes: 2
} as const;

export const WEATHER_CLOUD_BUDGET = {
  maxRenderableMeshes: 7,
  maxInstances: 96,
  maxGeneraPerSky: 2
} as const;

export const WEATHER_NIGHT_SKY_BUDGET = {
  maxStars: 1800,
  maxRenderableMeshes: 7,
  maxMoonMeshes: 2
} as const;

export const WEATHER_PERFORMANCE_BUDGET = {
  rain: { min: 30000, max: 80000 },
  snow: { min: 10000, max: 30000 },
  hail: { min: 1200, max: 4000 },
  sand: { min: 12000, max: 40000 },
  splash: { min: 200, max: 500 },
  sunnyDust: { max: 1500 },
  auroraStars: { max: 800 },
  nightSkyStars: { max: WEATHER_NIGHT_SKY_BUDGET.maxStars },
  meteors: { maxActive: WEATHER_METEOR_BUDGET.maxActiveMeteors }
} as const;

export const WEATHER_RENDERABLE_BUDGET = {
  clear: 10,
  cloudy: 8,
  rain: 8,
  storm: 10,
  stormBurst: 12,
  snow: 8,
  blizzard: 8,
  fog: 7,
  sandstorm: 9,
  aurora: 12
} as const;
