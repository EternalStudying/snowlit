import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WeatherController, WEATHER_WIND_BASE_SPEED } from '../core/WeatherController';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystem } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { weatherStateParameters } from '../core/weatherStateParameters';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import type { WeatherState } from '../model';

const frame = (delta: number): WeatherFrameState => ({
  elapsed: delta,
  delta,
  pointer: { x: 0, y: 0 },
  scrollY: 0
});

function closeTo(value: number, expected: number) {
  expect(value).toBeCloseTo(expected, 5);
}

function advanceSettledTarget(controller: WeatherController) {
  controller.update(frame(2));
  controller.update(frame(0));
}

async function waitForSceneObject(scene: THREE.Scene, name: string) {
  for (let index = 0; index < 50; index += 1) {
    const object = scene.getObjectByName(name);

    if (object) {
      return object;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  expect(scene.getObjectByName(name), name).toBeDefined();
  return scene.getObjectByName(name);
}

describe('WeatherController state machine', () => {
  it('defines procedural-weather runtime parameters for every semantic weather state', () => {
    const expectedStates: WeatherState[] = [
      'clear',
      'cloudy',
      'drizzle',
      'rain',
      'heavyRain',
      'storm',
      'lightSnow',
      'snow',
      'blizzard',
      'fog',
      'sandstorm',
      'aurora'
    ];

    expect(Object.keys(weatherStateParameters).sort()).toEqual([...expectedStates].sort());
    expect(weatherStateParameters.rain).toMatchObject({
      rain: 0.7,
      snow: 0,
      fogDensity: 0.006,
      lightning: 0.1,
      skyDarkness: 0.5,
      windMultiplier: 1.2
    });
    expect(weatherStateParameters.blizzard).toMatchObject({
      rain: 0,
      snow: 1,
      fogDensity: 0.025,
      lightning: 0,
      skyDarkness: 0.6,
      windMultiplier: 3
    });
    expect(weatherStateParameters.aurora).toMatchObject({
      rain: 0,
      snow: 0,
      fogDensity: 0.001,
      lightning: 0,
      skyDarkness: 0,
      windMultiplier: 0.3
    });
  });

  it('starts at a settled runtime state for the initial profile', () => {
    const profile = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const controller = new WeatherController(profile);

    expect(controller.nightSky).toBeDefined();
    expect(controller.environment).toBeDefined();
    expect(controller.currentProfile).toBe(profile);
    expect(controller.targetProfile).toBe(profile);
    expect(controller.transitionProgress).toBe(1);
    expect(controller.runtimeState).toMatchObject({
      currentProfile: profile,
      targetProfile: profile,
      transitionProgress: 1,
      rainIntensity: 0,
      snowIntensity: 0,
      lightningIntensity: 0,
      skyDarkness: 0,
      ambientWarmth: profile.ambientWarmth,
      particleIntensity: profile.particleIntensity
    });
    closeTo(controller.runtimeState.fogDensity, 0.0005);
    closeTo(controller.runtimeState.windMultiplier, 0.5);
  });

  it('transitions to a new state and interpolates runtime weather values', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const rain = getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 1;

    controller.setWeatherProfile(rain);
    expect(controller.targetProfile).toBe(rain);
    expect(controller.transitionProgress).toBe(0);

    const runtime = controller.update(frame(0.5));

    closeTo(runtime.transitionProgress, 0.5);
    closeTo(runtime.rainIntensity, 0.35);
    closeTo(runtime.snowIntensity, 0);
    closeTo(runtime.fogDensity, 0.00325);
    closeTo(runtime.lightningIntensity, 0.05);
    closeTo(runtime.skyDarkness, 0.25);
    closeTo(runtime.windMultiplier, 0.85);
    closeTo(runtime.ambientWarmth, 0.61);
    closeTo(runtime.particleIntensity, 0.85);
    closeTo(controller.wind.baseSpeed, WEATHER_WIND_BASE_SPEED * 0.85);
  });

  it('routes clear into storm through cloudy, rain, and heavyRain before storm', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const storm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(storm);
    expect(controller.targetProfile.weatherState).toBe('cloudy');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('rain');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('heavyRain');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('storm');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('storm');
    expect(controller.targetProfile.weatherVariant).toBe('thunderstorm');
  });

  it('routes storm back to clear through rain and cloudy', () => {
    const storm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' });
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const controller = new WeatherController(storm);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(clear);
    expect(controller.targetProfile.weatherState).toBe('rain');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('cloudy');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('clear');
  });

  it('routes clear into blizzard through lightSnow and snow', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const blizzard = getWeatherProfile({ weatherState: 'blizzard', weatherVariant: 'heavySnow' });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(blizzard);
    expect(controller.targetProfile.weatherState).toBe('lightSnow');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('snow');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('blizzard');
  });

  it('routes sandstorm into rain through clear, cloudy, and drizzle', () => {
    const sandstorm = getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'sandstorm' });
    const rain = getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' });
    const controller = new WeatherController(sandstorm);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(rain);
    expect(controller.targetProfile.weatherState).toBe('clear');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('cloudy');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('drizzle');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('rain');
  });

  it('does not reset progress for the same final target state, variant, and precipitation kind', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const storm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 1;

    controller.setWeatherProfile(storm);
    controller.update(frame(0.25));
    const progress = controller.transitionProgress;
    const targetState = controller.targetProfile.weatherState;

    controller.setWeatherProfile({ ...storm });

    expect(controller.transitionProgress).toBe(progress);
    expect(controller.targetProfile.weatherState).toBe(targetState);
    expect(controller.targetProfile.weatherState).toBe('cloudy');
  });

  it('replaces the remaining route queue when a new final target arrives', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const storm = getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' });
    const rain = getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(storm);
    expect(controller.targetProfile.weatherState).toBe('cloudy');

    controller.setWeatherProfile(rain);
    expect(controller.targetProfile.weatherState).toBe('rain');

    advanceSettledTarget(controller);
    expect(controller.targetProfile.weatherState).toBe('rain');
    expect(controller.targetProfile.weatherVariant).toBe('moderateRain');
  });

  it('treats precipitationKind changes as a new target and swaps rain precipitation for hail', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const rain = getWeatherProfile({
      weatherState: 'rain',
      weatherVariant: 'moderateRain',
      precipitationKind: 'rain'
    });
    const hail = getWeatherProfile({
      weatherState: 'rain',
      weatherVariant: 'moderateRain',
      precipitationKind: 'hail'
    });
    const controller = new WeatherController(rain, new WindSystem(), { scene, camera });

    try {
      await waitForSceneObject(scene, 'rain-precipitation-system');
      await waitForSceneObject(scene, 'rain-splash-precipitation-system');

      controller.setWeatherProfile(hail);

      expect(controller.targetProfile.precipitationKind).toBe('hail');
      expect(controller.transitionProgress).toBe(0);
      await waitForSceneObject(scene, 'hail-precipitation-system');
      expect(scene.getObjectByName('rain-precipitation-system')).toBeUndefined();
      expect(scene.getObjectByName('rain-splash-precipitation-system')).toBeUndefined();
    } finally {
      controller.dispose();
    }
  });

  it('treats daylightHint changes as a new target while preserving repeated-target stability', () => {
    const day = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' });
    const night = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'night' });
    const controller = new WeatherController(day);

    controller.setWeatherProfile(night);
    expect(controller.targetProfile.daylightHint).toBe('night');
    expect(controller.transitionProgress).toBe(0);

    const runtime = controller.update(frame(0.25));
    const progress = controller.transitionProgress;

    expect(runtime.orchestration.sunnyOpticalVisibility).toBeLessThan(1);
    expect(runtime.orchestration.nightSkyVisibility).toBeGreaterThan(0);

    controller.setWeatherProfile({ ...night });
    expect(controller.transitionProgress).toBe(progress);
  });

  it('treats weatherVariant changes as a new transition target', () => {
    const mist = getWeatherProfile({ weatherState: 'fog', weatherVariant: 'mist' });
    const haze = getWeatherProfile({ weatherState: 'fog', weatherVariant: 'haze' });
    const controller = new WeatherController(mist);

    controller.setWeatherProfile(haze);

    expect(controller.targetProfile.weatherState).toBe('fog');
    expect(controller.targetProfile.weatherVariant).toBe('haze');
    expect(controller.transitionProgress).toBe(0);
  });

  it('preserves hailStorm precipitation kind on the final routed storm profile', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const hailStorm = getWeatherProfile({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      precipitationKind: 'hail'
    });
    const controller = new WeatherController(clear);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(hailStorm);
    expect(controller.targetProfile.weatherState).toBe('cloudy');

    advanceSettledTarget(controller);
    advanceSettledTarget(controller);
    advanceSettledTarget(controller);

    expect(controller.targetProfile).toMatchObject({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      precipitationKind: 'hail'
    });
  });

  it('clamps transition progress to one and keeps wind based on runtime multiplier', () => {
    const snow = getWeatherProfile({ weatherState: 'snow', weatherVariant: 'snow' });
    const blizzard = getWeatherProfile({ weatherState: 'blizzard', weatherVariant: 'heavySnow' });
    const controller = new WeatherController(snow);
    controller.transitionSpeed = 10;

    controller.setWeatherProfile(blizzard);
    const runtime = controller.update(frame(1));

    expect(runtime.transitionProgress).toBe(1);
    closeTo(runtime.snowIntensity, 1);
    closeTo(runtime.windMultiplier, 3);
    closeTo(controller.wind.baseSpeed, WEATHER_WIND_BASE_SPEED * 3);
  });

  it('drives night sky, cloud sky, precipitation, atmosphere, electrical, optical, and environment systems together', () => {
    const clear = getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' });
    const rain = getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' });
    const controller = new WeatherController(clear);
    const systems: WeatherSystem[] = [
      controller.nightSky,
      controller.cloudSky,
      controller.precipitation,
      controller.atmosphere,
      controller.electrical,
      controller.optical,
      controller.environment
    ];
    const calls = systems.map(() => ({ setProfile: 0, update: 0, dispose: 0 }));

    systems.forEach((system, index) => {
      system.setProfile = (_profile: WeatherProfile) => {
        calls[index].setProfile += 1;
      };
      system.update = (_frame: WeatherFrameState, _runtime: WeatherRuntimeState) => {
        calls[index].update += 1;
      };
      system.dispose = () => {
        calls[index].dispose += 1;
      };
    });

    controller.setWeatherProfile(rain);
    controller.update(frame(0.2));
    controller.dispose();

    calls.forEach((call) => {
      expect(call.setProfile).toBe(1);
      expect(call.update).toBe(1);
      expect(call.dispose).toBe(1);
    });
  });
});
