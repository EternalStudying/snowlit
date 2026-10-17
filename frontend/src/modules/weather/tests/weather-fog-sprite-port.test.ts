import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { WeatherController } from '../core/WeatherController';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import {
  FogAtmosphereLayer,
  HAZE_SPRITE_SETTINGS,
  MIST_SPRITE_SETTINGS
} from '../systems/atmosphere/FogAtmosphereLayer';

const frame = (elapsed = 0.4): WeatherFrameState => ({
  elapsed,
  delta: 0.16,
  pointer: { x: 0, y: 0 },
  scrollY: 0
});

function absolute(path: string) {
  return resolve(process.cwd(), path);
}

function fileExists(path: string) {
  return existsSync(absolute(path));
}

function readSource(path: string) {
  return fileExists(path) ? readFileSync(absolute(path), 'utf8') : '';
}

function runtimeFor(input: Parameters<typeof getWeatherProfile>[0]): WeatherRuntimeState {
  return new WeatherController(getWeatherProfile(input)).runtimeState;
}

function createFogLayer(variant: 'mist' | 'haze' = 'mist') {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 6);
  const wind = new WindSystem();
  const layer = new FogAtmosphereLayer(scene, camera, wind, getWeatherProfile({ weatherState: 'fog', weatherVariant: variant }));

  return { scene, camera, wind, layer };
}

function fogSpriteMeshes(scene: THREE.Scene) {
  const group = scene.getObjectByName('fog-atmosphere-system') as THREE.Group;

  return group.children.filter((child): child is THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> => {
    return child instanceof THREE.Mesh && child.geometry instanceof THREE.InstancedBufferGeometry;
  });
}

function instanceCount(mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>) {
  return mesh.geometry.instanceCount === Infinity ? 0 : mesh.geometry.instanceCount;
}

function totalInstances(scene: THREE.Scene) {
  return fogSpriteMeshes(scene).reduce((sum, mesh) => sum + instanceCount(mesh), 0);
}

function meshByName(scene: THREE.Scene, name: string) {
  return fogSpriteMeshes(scene).find((mesh) => mesh.name === name);
}

describe('procedural-weather stage 10 fog sprite port', () => {
  it('keeps the imported fog sprite assets and MIT license notice in the fog assets directory', () => {
    expect(fileExists('src/modules/weather/effects/fog/assets/fog-element.webp')).toBe(true);
    expect(fileExists('src/modules/weather/effects/fog/assets/dense-fog-element.webp')).toBe(true);
    expect(fileExists('src/modules/weather/effects/fog/assets/LICENSE.react-weather-effects.txt')).toBe(true);

    const license = readSource('src/modules/weather/effects/fog/assets/LICENSE.react-weather-effects.txt');

    expect(license).toContain('rauschermate/react-weather-effects');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2024 Mate Rauscher');
  });

  it('creates fog-atmosphere-system with instanced sprite layers matching the reference counts and ratios', () => {
    const mist = createFogLayer('mist');

    expect(mist.scene.getObjectByName('fog-atmosphere-system')).toBeDefined();
    expect(totalInstances(mist.scene)).toBe(18);
    expect(fogSpriteMeshes(mist.scene)).toHaveLength(2);
    expect(instanceCount(meshByName(mist.scene, 'fog-sprite-fog-element')!)).toBeGreaterThan(
      instanceCount(meshByName(mist.scene, 'fog-sprite-dense-fog-element')!)
    );

    mist.layer.dispose();
    expect(mist.scene.children).toHaveLength(0);

    const haze = createFogLayer('haze');

    expect(totalInstances(haze.scene)).toBe(38);
    expect(fogSpriteMeshes(haze.scene)).toHaveLength(2);
    expect(instanceCount(meshByName(haze.scene, 'fog-sprite-dense-fog-element')!)).toBeGreaterThan(
      instanceCount(meshByName(haze.scene, 'fog-sprite-fog-element')!)
    );

    haze.layer.dispose();
    expect(haze.scene.children).toHaveLength(0);
  });

  it('keeps the page-visible fog pass darker, softer, and stronger than the first sprite port', () => {
    const shaderSource = readSource('src/modules/weather/systems/atmosphere/fogSpriteShaders.ts');

    expect(MIST_SPRITE_SETTINGS.color).toBeLessThan(0xc8d4d8);
    expect(MIST_SPRITE_SETTINGS.alphaMax).toBeGreaterThanOrEqual(0.46);
    expect(MIST_SPRITE_SETTINGS.opacityScale).toBeGreaterThan(1);
    expect(MIST_SPRITE_SETTINGS.scaleMax).toBeGreaterThan(2);
    expect(HAZE_SPRITE_SETTINGS.color).toBeLessThan(MIST_SPRITE_SETTINGS.color);
    expect(HAZE_SPRITE_SETTINGS.alphaMax).toBeGreaterThanOrEqual(0.36);
    expect(HAZE_SPRITE_SETTINGS.opacityScale).toBeGreaterThan(MIST_SPRITE_SETTINGS.opacityScale);
    expect(shaderSource).toContain('pow(fogSample.a, 0.88)');
    expect(shaderSource).toContain('viewportSize.x * 0.38');
    expect(shaderSource).toContain('clamp(alpha, 0.0, 0.58)');
  });

  it('uses shader-driven sprite drift instead of independent mesh draw calls or per-frame buffer writes', () => {
    const layerSource = readSource('src/modules/weather/systems/atmosphere/FogAtmosphereLayer.ts');
    const spriteSource = readSource('src/modules/weather/systems/atmosphere/FogSpriteLayer.ts');
    const shaderSource = readSource('src/modules/weather/systems/atmosphere/fogSpriteShaders.ts');

    expect(spriteSource).toContain('InstancedBufferGeometry');
    expect(spriteSource).toContain('aOrigin');
    expect(spriteSource).toContain('aScale');
    expect(spriteSource).toContain('aAlpha');
    expect(spriteSource).toContain('aDrift');
    expect(spriteSource).toContain('aPhase');
    expect(spriteSource).toContain('instanceCount');
    expect(spriteSource).toContain('TextureLoader');
    expect(spriteSource).toContain('texture.dispose()');
    expect(layerSource).toContain('FogSpriteLayer');
    expect(layerSource).toContain('MIST_SPRITE_SETTINGS');
    expect(layerSource).toContain('HAZE_SPRITE_SETTINGS');
    expect(layerSource).not.toContain('createFogPlane');

    const updateSource = spriteSource.slice(spriteSource.indexOf('update('), spriteSource.indexOf('dispose()', spriteSource.indexOf('update(')));
    expect(updateSource).not.toMatch(/for\s*\(/);
    expect(updateSource).not.toContain('.array');
    expect(updateSource).not.toContain('setAttribute');

    expect(shaderSource).toContain('uniform sampler2D fogMap');
    expect(shaderSource).toContain('uniform vec2 viewportSize');
    expect(shaderSource).toContain('uniform vec2 windOffset');
    expect(shaderSource).toContain('uniform float globalOpacity');
    expect(shaderSource).toContain('uniform float centerProtection');
    expect(shaderSource).toContain('uniform float readabilityRadius');
    expect(shaderSource).toContain('attribute vec2 aOrigin');
    expect(shaderSource).toContain('mod(');
    expect(shaderSource).toContain('gl_FragColor');
  });

  it('updates profile density and wind uniforms without mutating sprite instance buffers per frame', () => {
    const { scene, wind, layer } = createFogLayer('mist');
    const runtime = runtimeFor({ weatherState: 'fog', weatherVariant: 'mist' });
    const [mesh] = fogSpriteMeshes(scene);
    const origin = mesh.geometry.getAttribute('aOrigin') as THREE.InstancedBufferAttribute;
    const originBefore = Array.from(origin.array as Float32Array);

    wind.update(0.16);
    layer.update(frame(0.48), runtime);

    const originAfter = Array.from(origin.array as Float32Array);

    expect(originAfter).toEqual(originBefore);
    expect(mesh.material.uniforms.time.value).toBe(0.48);
    expect(mesh.material.uniforms.windOffset.value.length()).toBeGreaterThan(0);
    expect(mesh.material.uniforms.globalOpacity.value).toBeGreaterThan(0);

    layer.setProfile(getWeatherProfile({ weatherState: 'fog', weatherVariant: 'haze' }));
    expect(totalInstances(scene)).toBe(38);

    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
