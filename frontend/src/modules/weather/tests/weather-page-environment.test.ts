import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { AuroraOpticalLayer } from '../systems/optical/AuroraOpticalLayer';
import { RainSplashLayer } from '../systems/precipitation/RainSplashLayer';
import { getViewportSizeAtDepth } from '../systems/shared/viewportPlane';

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
  it('keeps page-environment resources system-owned and adds shared resize-safe viewport helpers', () => {
    const helper = readSource('src/modules/weather/systems/shared/viewportPlane.ts');
    const layerFiles = [
      'src/modules/weather/systems/optical/WetLensOverlayLayer.ts',
      'src/modules/weather/systems/optical/FrostOverlayLayer.ts',
      'src/modules/weather/systems/environment/WetSurfaceLayer.ts',
      'src/modules/weather/systems/environment/SnowAccumulationLayer.ts',
      'src/modules/weather/systems/environment/SandstormTintLayer.ts',
      'src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts',
      'src/modules/weather/systems/atmosphere/FogSpriteLayer.ts',
      'src/modules/weather/systems/optical/AuroraOpticalLayer.ts',
      'src/modules/weather/systems/precipitation/RainSplashLayer.ts'
    ];

    expect(fileExists('src/modules/weather/systems/shared/viewportPlane.ts')).toBe(true);
    expect(helper).toContain('getViewportSizeAtDepth');
    expect(helper).toContain('syncViewportPlane');
    expect(helper).toContain('ViewportPlaneState');
    expect(helper).toContain('fillBottomEdgePositions');
    expect(helper).toContain('disposeObjectTree');

    layerFiles.forEach((path) => {
      const source = readSource(path);

      if (path.endsWith('FogAtmosphereLayer.ts')) {
        expect(source, path).toContain('FogSpriteLayer');
      } else {
        expect(source, path).toContain('../shared/viewportPlane');
        expect(source, path).toContain('sync');
      }
      expect(source, path).not.toContain('new EffectComposer');
    });

    const adapterFiles = [
      'src/modules/weather/effects/cloudy/CloudyWeatherScene.ts',
      'src/modules/weather/effects/aurora/AuroraWeatherScene.ts',
      'src/modules/weather/effects/rain/RainWeatherScene.ts',
      'src/modules/weather/effects/snow/SnowWeatherScene.ts',
      'src/modules/weather/effects/fog/FogWeatherScene.ts',
      'src/modules/weather/effects/sandstorm/SandstormWeatherScene.ts'
    ];

    adapterFiles.forEach((path) => {
      const source = readSource(path);

      expect(source, path).not.toContain('new THREE.ShaderMaterial');
      expect(source, path).not.toContain('new THREE.PlaneGeometry');
      expect(source, path).not.toContain('new THREE.BufferGeometry');
    });
  });

  it('adds center readability protection to wet lens and frost without scene sampling', () => {
    const wetLensLayer = readSource('src/modules/weather/systems/optical/WetLensOverlayLayer.ts');
    const wetLensShader = readSource('src/modules/weather/effects/optical/wetLensShaders.ts');
    const frostLayer = readSource('src/modules/weather/systems/optical/FrostOverlayLayer.ts');
    const frostShader = readSource('src/modules/weather/effects/optical/frostShaders.ts');

    expect(wetLensLayer).toContain('centerProtection');
    expect(wetLensLayer).toContain('readabilityRadius');
    expect(wetLensLayer).toContain('edgeWetness');
    expect(wetLensShader).toContain('centerProtection');
    expect(wetLensShader).toContain('readabilityRadius');
    expect(wetLensShader).toContain('centerClear');
    expect(wetLensShader).toContain('streak *= edgeWetness');
    expect(wetLensShader).not.toContain('tScene');

    expect(frostLayer).toContain('LIGHT_SNOW_FROST_INTENSITY');
    expect(frostLayer).toContain('BLIZZARD_FROST_INTENSITY_CAP');
    expect(frostLayer).toContain('readabilityRadius');
    expect(frostShader).toContain('centerProtection');
    expect(frostShader).toContain('readabilityRadius');
    expect(frostShader).toContain('centerClear');
    expect(frostShader).toContain('edgeFrost');
    expect(frostShader).not.toContain('tScene');
  });

  it('keeps bottom environment overlays constrained to bottom and corner regions', () => {
    const splashLayer = readSource('src/modules/weather/systems/precipitation/RainSplashLayer.ts');
    const splashShader = readSource('src/modules/weather/effects/rain/rainSplashShaders.ts');
    const wetSurfaceLayer = readSource('src/modules/weather/systems/environment/WetSurfaceLayer.ts');
    const wetSurfaceShader = readSource('src/modules/weather/effects/environment/wetSurfaceShaders.ts');
    const snowLayer = readSource('src/modules/weather/systems/environment/SnowAccumulationLayer.ts');
    const snowShader = readSource('src/modules/weather/effects/environment/snowAccumulationShaders.ts');

    expect(splashLayer).toContain('BOTTOM_SPLASH_BAND');
    expect(splashLayer).toContain('fillBottomEdgePositions');
    expect(splashShader).toContain('bottomOnly');
    expect(splashShader).toContain('edgeFade');

    expect(wetSurfaceLayer).toContain('heightScale: 0.36');
    expect(wetSurfaceLayer).toContain('yOffsetScale: -0.34');
    expect(wetSurfaceShader).toContain('bottomBand');
    expect(wetSurfaceShader).toContain('cornerRestraint');

    expect(snowLayer).toContain('heightScale: 0.4');
    expect(snowLayer).toContain('yOffsetScale: -0.33');
    expect(snowShader).toContain('bottomBand');
    expect(snowShader).toContain('cornerSnow');
    expect(snowShader).toContain('centerReadability');
  });

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

  it('protects atmosphere and aurora overlays from becoming full-page masks', () => {
    const fog = readSource('src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts');
    const fogSprite = readSource('src/modules/weather/systems/atmosphere/FogSpriteLayer.ts');
    const fogShader = readSource('src/modules/weather/systems/atmosphere/fogSpriteShaders.ts');
    const tint = readSource('src/modules/weather/systems/environment/SandstormTintLayer.ts');
    const tintShader = readSource('src/modules/weather/effects/environment/sandstormTintShaders.ts');
    const aurora = readSource('src/modules/weather/systems/optical/AuroraOpticalLayer.ts');
    const auroraShader = readSource('src/modules/weather/effects/aurora/auroraShaders.ts');

    expect(fog).toContain('readabilityRadius');
    expect(fog).toContain('FogSpriteLayer');
    expect(fogSprite).toContain('getViewportSizeAtDepth');
    expect(fogShader).toContain('centerClear');
    expect(fogShader).toContain('readabilityRadius');
    expect(fogShader).toContain('centerProtection');
    expect(fogShader).toContain('vVisibility');

    expect(tint).toContain('readabilityRadius');
    expect(tint).toContain('syncViewportPlane');
    expect(tintShader).toContain('readableCenter');
    expect(tintShader).toContain('edgeLift');

    expect(aurora).toContain('topCoverage');
    expect(aurora).toContain('syncViewportPlane');
    expect(auroraShader).toContain('upper');
    expect(auroraShader).toContain('centerReadability');
  });

  it('keeps aurora curtains near the top bar and stretched across the viewport', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const layer = new AuroraOpticalLayer(scene, camera, getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' }));

    layer.update(frame(0.32), runtimeFor({ weatherState: 'aurora', weatherVariant: 'aurora' }));

    const curtain = scene.getObjectByName('aurora-curtain-1') as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
    const viewport = getViewportSizeAtDepth(camera, curtain.position.z);

    expect(curtain.position.y).toBeGreaterThan(viewport.height * 0.36);
    expect(curtain.geometry.parameters.width).toBeGreaterThan(viewport.width * 0.78);
    expect(curtain.geometry.parameters.height).toBeLessThan(viewport.height * 0.18);

    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('does not introduce forbidden page-capture or post-processing techniques', () => {
    const weatherSources = readWeatherSources();
    const layerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');

    expect(weatherSources).not.toContain('EffectComposer');
    expect(weatherSources).not.toContain('html2canvas');
    expect(weatherSources).not.toContain('captureStream');
    expect(weatherSources).not.toContain('getDisplayMedia');
    expect(weatherSources).not.toContain('tScene');
    expect(weatherSources).not.toContain('scene.background =');
    expect(layerSource).toContain('position: fixed');
    expect(layerSource).toContain('pointer-events: none');
    expect(layerSource).toContain('renderer.setSize(width, height, false)');
  });
});
