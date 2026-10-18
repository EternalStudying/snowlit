import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { WeatherController } from '../core/WeatherController';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { FogAtmosphereLayer, HAZE_SPRITE_SETTINGS, MIST_SPRITE_SETTINGS } from '../systems/atmosphere/FogAtmosphereLayer';

const frame = (elapsed = 0.4): WeatherFrameState => ({
  elapsed,
  delta: 0.16,
  pointer: { x: 0, y: 0 },
  scrollY: 0
});

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
    expect(MIST_SPRITE_SETTINGS.color).toBeLessThan(0xc8d4d8);
    expect(MIST_SPRITE_SETTINGS.alphaMax).toBeGreaterThanOrEqual(0.46);
    expect(MIST_SPRITE_SETTINGS.opacityScale).toBeGreaterThan(1);
    expect(MIST_SPRITE_SETTINGS.scaleMax).toBeGreaterThan(2);
    expect(HAZE_SPRITE_SETTINGS.color).toBeLessThan(MIST_SPRITE_SETTINGS.color);
    expect(HAZE_SPRITE_SETTINGS.alphaMax).toBeGreaterThanOrEqual(0.36);
    expect(HAZE_SPRITE_SETTINGS.opacityScale).toBeGreaterThan(MIST_SPRITE_SETTINGS.opacityScale);
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
