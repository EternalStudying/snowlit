import { describe, expect, it } from 'vitest';
import { resolveWeatherTransitionRoute } from '../core/weatherTransitionRoutes';

describe('procedural-weather stage 9 transition routes', () => {
  it('routes clear into storm through natural rain buildup', () => {
    expect(resolveWeatherTransitionRoute('clear', 'storm')).toEqual(['cloudy', 'rain', 'heavyRain', 'storm']);
  });

  it('routes storm back to clear through rain and cloudy', () => {
    expect(resolveWeatherTransitionRoute('storm', 'clear')).toEqual(['rain', 'cloudy', 'clear']);
  });

  it('routes clear into blizzard through the snow family', () => {
    expect(resolveWeatherTransitionRoute('clear', 'blizzard')).toEqual(['lightSnow', 'snow', 'blizzard']);
  });

  it('routes blizzard back to clear through softer snowfall', () => {
    expect(resolveWeatherTransitionRoute('blizzard', 'clear')).toEqual(['snow', 'lightSnow', 'clear']);
  });

  it('routes sandstorm into rain by clearing dust before drizzle', () => {
    expect(resolveWeatherTransitionRoute('sandstorm', 'rain')).toEqual(['clear', 'cloudy', 'drizzle', 'rain']);
  });

  it('lets aurora fade directly into clear', () => {
    expect(resolveWeatherTransitionRoute('aurora', 'clear')).toEqual(['clear']);
  });

  it('falls back to a direct target for unspecified transitions', () => {
    expect(resolveWeatherTransitionRoute('rain', 'snow')).toEqual(['snow']);
  });
});
