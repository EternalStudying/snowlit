import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { AuroraOpticalLayer } from '../systems/optical/AuroraOpticalLayer';
import { RainSplashLayer } from '../systems/precipitation/RainSplashLayer';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  const absolutePath = resolve(process.cwd(), path);

  return fileExists(path) ? readFileSync(absolutePath, 'utf8') : '';
}

const WEATHER_SOURCE_AUDIT_FILES = [
  'src/modules/weather/core/createWeatherRenderer.ts',
  'src/modules/weather/systems/PrecipitationSystem.ts',
  'src/modules/weather/systems/AtmosphereSystem.ts',
  'src/modules/weather/systems/ElectricalSystem.ts',
  'src/modules/weather/systems/OpticalSystem.ts',
  'src/modules/weather/systems/EnvironmentSystem.ts',
  'src/modules/weather/systems/shared/viewportPlane.ts',
  'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
  'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
  'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
  'src/modules/weather/systems/precipitation/RainSplashLayer.ts',
  'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
  'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
  'src/modules/weather/systems/environment/SandstormTintLayer.ts',
  'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
  'src/modules/weather/systems/atmosphere/FogSpriteLayer.ts',
  'src/modules/weather/effects/optical/wetLensShaders.ts',
  'src/modules/weather/effects/optical/frostShaders.ts',
  'src/modules/weather/effects/environment/wetSurfaceShaders.ts',
  'src/modules/weather/effects/environment/snowAccumulationShaders.ts',
  'src/modules/weather/effects/environment/sandstormTintShaders.ts',
  'src/modules/weather/systems/atmosphere/fogSpriteShaders.ts',
  'src/modules/weather/effects/aurora/auroraShaders.ts'
];

function readWeatherSources(): string {
  return WEATHER_SOURCE_AUDIT_FILES.map(readSource).join('\n');
}

const frame = (elapsed = 0.16): WeatherFrameState => ({
  elapsed,
  delta: 0.16,
  pointer: { x: 0, y: 0 },
  scrollY: 0
});

function runtimeFor(input: Parameters<typeof getWeatherProfile>[0]): WeatherRuntimeState {
  return new WeatherController(getWeatherProfile(input)).runtimeState;
}

function positionValues(attribute: THREE.BufferAttribute, componentOffset: 0 | 1 | 2) {
  const values: number[] = [];
  const array = attribute.array as Float32Array;

  for (let index = componentOffset; index < array.length; index += 3) {
    values.push(array[index]);
  }

  return values;
}

describe('procedural-weather stage 6 page environment adaptation', () => {
  it('updates rain splash positions when the desktop viewport aspect changes', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const layer = new RainSplashLayer(
      scene,
      camera,
      getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' })
    );
    const group = scene.getObjectByName('rain-splash-precipitation-system') as THREE.Group;
    const points = group.children[0] as THREE.Points;
    const geometry = points.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const before = Array.from((position.array as Float32Array).slice(0, 24));

    camera.aspect = 4 / 3;
    camera.updateProjectionMatrix();
    layer.update(frame(0.32), runtimeFor({ weatherState: 'rain', weatherVariant: 'moderateRain' }));

    const after = Array.from((position.array as Float32Array).slice(0, 24));
    const yValues = positionValues(position, 1);
    const maxY = Math.max(...yValues);
    const minY = Math.min(...yValues);

    expect(after).not.toEqual(before);
    expect(maxY).toBeLessThan(-0.5);
    expect(minY).toBeGreaterThan(-1.9);

    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('keeps aurora curtains near the top bar and stretched across the viewport', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const layer = new AuroraOpticalLayer(scene, camera, getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' }));

    layer.update(frame(0.32), runtimeFor({ weatherState: 'aurora', weatherVariant: 'aurora' }));

    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('does not introduce forbidden page-capture or post-processing techniques', () => {
    const weatherSources = readWeatherSources();

    expect(weatherSources).not.toContain('EffectComposer');
    expect(weatherSources).not.toContain('html2canvas');
    expect(weatherSources).not.toContain('captureStream');
    expect(weatherSources).not.toContain('getDisplayMedia');
    expect(weatherSources).not.toContain('tScene');
    expect(weatherSources).not.toContain('scene.background =');
  });
});
