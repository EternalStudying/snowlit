import type { WeatherState } from '../model';
import type { WeatherStateParameters } from './types';

export const weatherStateParameters: Record<WeatherState, WeatherStateParameters> = {
  clear: {
    rain: 0,
    snow: 0,
    fogDensity: 0.0005,
    lightning: 0,
    skyDarkness: 0,
    windMultiplier: 0.5
  },
  cloudy: {
    rain: 0,
    snow: 0,
    fogDensity: 0.002,
    lightning: 0,
    skyDarkness: 0.2,
    windMultiplier: 0.8
  },
  drizzle: {
    rain: 0.3,
    snow: 0,
    fogDensity: 0.004,
    lightning: 0,
    skyDarkness: 0.3,
    windMultiplier: 0.7
  },
  rain: {
    rain: 0.7,
    snow: 0,
    fogDensity: 0.006,
    lightning: 0.1,
    skyDarkness: 0.5,
    windMultiplier: 1.2
  },
  heavyRain: {
    rain: 1,
    snow: 0,
    fogDensity: 0.01,
    lightning: 0.3,
    skyDarkness: 0.7,
    windMultiplier: 1.8
  },
  storm: {
    rain: 1,
    snow: 0,
    fogDensity: 0.015,
    lightning: 0.8,
    skyDarkness: 0.85,
    windMultiplier: 2.5
  },
  lightSnow: {
    rain: 0,
    snow: 0.3,
    fogDensity: 0.003,
    lightning: 0,
    skyDarkness: 0.15,
    windMultiplier: 0.6
  },
  snow: {
    rain: 0,
    snow: 0.7,
    fogDensity: 0.006,
    lightning: 0,
    skyDarkness: 0.3,
    windMultiplier: 1
  },
  blizzard: {
    rain: 0,
    snow: 1,
    fogDensity: 0.025,
    lightning: 0,
    skyDarkness: 0.6,
    windMultiplier: 3
  },
  fog: {
    rain: 0,
    snow: 0,
    fogDensity: 0.03,
    lightning: 0,
    skyDarkness: 0.25,
    windMultiplier: 0.2
  },
  sandstorm: {
    rain: 0,
    snow: 0,
    fogDensity: 0.02,
    lightning: 0.1,
    skyDarkness: 0.5,
    windMultiplier: 3
  },
  aurora: {
    rain: 0,
    snow: 0,
    fogDensity: 0.001,
    lightning: 0,
    skyDarkness: 0,
    windMultiplier: 0.3
  }
};
