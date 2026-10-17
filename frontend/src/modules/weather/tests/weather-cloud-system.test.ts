import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WeatherController } from '../core/WeatherController';
import type { DaylightHint, WeatherState, WeatherVariant } from '../model';
import type { WeatherFrameState } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { ALL_CLOUD_GENERA, type CloudGenus, type SkyProfile } from '../profiles/skyProfiles';
import { CloudSkySystem } from '../systems/CloudSkySystem';
import { WEATHER_CLOUD_BUDGET } from '../systems/clouds/cloudLayerProfiles';
import { CloudSkyLayer } from '../systems/clouds/CloudSkyLayer';
import { getCloudLightingProfile } from '../systems/clouds/cloudLightingProfile';

function fileExists(path: string) {
  return existsSync(resolve(process.cwd(), path));
}

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.04, y: -0.02 },
  scrollY: 24
});

async function waitForCloudSky(scene: THREE.Scene, expectPresent = true, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const group = scene.getObjectByName('cloud-sky-system');

    if (expectPresent ? Boolean(group) : !group) {
      return group;
    }

    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }

  const group = scene.getObjectByName('cloud-sky-system');
  if (expectPresent) {
    expect(group).toBeDefined();
  } else {
    expect(group).toBeUndefined();
  }
  return group;
}

async function waitForObject(scene: THREE.Scene, name: string, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const object = scene.getObjectByName(name);

    if (object) {
      return object;
    }

    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }

  expect(scene.getObjectByName(name), name).toBeDefined();
  return scene.getObjectByName(name);
}

function createController(input: {
  weatherState: WeatherState;
  weatherVariant: WeatherVariant;
  daylightHint?: DaylightHint;
  precipitationKind?: Parameters<typeof getWeatherProfile>[0]['precipitationKind'];
}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 6);
  const profile = getWeatherProfile(input);
  const controller = new WeatherController(profile, new WindSystem(), {
    scene,
    camera
  });

  return { scene, camera, controller, profile };
}

function renderableCount(root: THREE.Object3D) {
  let count = 0;

  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      count += 1;
    }
  });

  return count;
}

function cloudMaterials(root: THREE.Object3D) {
  const materials: THREE.ShaderMaterial[] = [];

  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name.startsWith('cloud-sky-dghez-cloud')) {
      materials.push(object.material as THREE.ShaderMaterial);
    }
  });

  return materials;
}

function cloudMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name.startsWith('cloud-sky-dghez-cloud')) {
      meshes.push(object);
    }
  });

  return meshes;
}

async function settleCloudSystem(scene: THREE.Scene, controller: WeatherController, elapsed = 0.4) {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
    controller.update(frame(elapsed + index * 0.08));
  }

  return scene.getObjectByName('cloud-sky-system');
}

function cloudMesh(root: THREE.Object3D, name: string) {
  let mesh: THREE.Mesh | null = null;

  root.traverse((object) => {
    if (!mesh && object instanceof THREE.Mesh && object.name === name) {
      mesh = object;
    }
  });

  expect(mesh, name).toBeDefined();
  return mesh!;
}

function projectedCloudBoxes(meshes: THREE.Mesh[]) {
  return meshes.map((mesh) => ({
    name: mesh.name,
    left: mesh.position.x - mesh.scale.x / 2,
    right: mesh.position.x + mesh.scale.x / 2,
    bottom: mesh.position.y - mesh.scale.y / 2,
    top: mesh.position.y + mesh.scale.y / 2
  }));
}

function overlappingPairs(meshes: THREE.Mesh[]) {
  const boxes = projectedCloudBoxes(meshes);
  const pairs: string[] = [];

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      const overlaps =
        left.left < right.right &&
        left.right > right.left &&
        left.bottom < right.top &&
        left.top > right.bottom;

      if (overlaps) {
        pairs.push(`${left.name}/${right.name}`);
      }
    }
  }

  return pairs;
}

function firstCloudMesh(root: THREE.Object3D) {
  let mesh: THREE.Mesh | null = null;

  root.traverse((object) => {
    if (!mesh && object instanceof THREE.Mesh && object.name.startsWith('cloud-sky-')) {
      mesh = object;
    }
  });

  expect(mesh).toBeDefined();
  return mesh!;
}

function skyProfileForGenus(genus: CloudGenus): SkyProfile {
  return {
    daylight: 'day',
    cloud: {
      enabled: true,
      mood: 'partlyCloudy',
      primary: genus,
      coverage: 0.62,
      opacity: 0.7,
      density: 0.54,
      altitude: 'mid',
      drift: 0.28,
      morph: 0.24,
      silverLiningEligible: true,
      internalLightningEligible: false,
      suppressByWeather: false
    },
    celestial: {
      mode: 'off',
      enabled: false,
      starVisibility: 0,
      milkyWayVisibility: 0,
      moonVisibility: 0,
      horizonGlow: 0,
      meteorRate: 0,
      auroraIntegration: false
    },
    preferWeatherDominance: false,
    preferCloudDominance: true,
    preferCelestialDominance: false,
    reason: 'test-only cloud genus profile'
  };
}

function cloudLightingFor(skyProfile: SkyProfile) {
  return getCloudLightingProfile(
    getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'partlyCloudy', daylightHint: 'day' }),
    skyProfile
  );
}

describe('procedural-clouds stage 12 cloud sky system', () => {
  it('adds CloudSkySystem to WeatherController as a real sixth system', () => {
    const controllerSource = readSource('src/modules/weather/core/WeatherController.ts');
    const typesSource = readSource('src/modules/weather/core/types.ts');

    expect(fileExists('src/modules/weather/systems/CloudSkySystem.ts')).toBe(true);
    expect(fileExists('src/modules/weather/systems/clouds/CloudSkyLayer.ts')).toBe(true);
    expect(controllerSource).toContain('CloudSkySystem');
    expect(controllerSource).toContain('readonly cloudSky');
    expect(controllerSource).toContain('new CloudSkySystem(systemContext)');
    expect(controllerSource).toContain('this.cloudSky');
    expect(typesSource).toContain('daylightHint?: DaylightHint');
  });

  it('creates five partlyCloudy wide puffy dghez cloud meshes without activating the old cloud-atmosphere owner', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene);
      controller.update(frame());

      const cloudGroup = scene.getObjectByName('cloud-sky-system');
      const meshes = cloudMeshes(cloudGroup!);
      expect(cloudGroup).toBeDefined();
      expect(meshes).toHaveLength(5);
      expect(renderableCount(cloudGroup!)).toBeLessThanOrEqual(WEATHER_CLOUD_BUDGET.maxRenderableMeshes);
      expect(scene.getObjectByName('cloud-atmosphere-system')).toBeUndefined();
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('creates five partlyCloudy cloud puffs and seven overcast cloud puffs without overlap', async () => {
    const cases = [
      { weatherVariant: 'partlyCloudy' as WeatherVariant, expectedPuffs: 5 },
      { weatherVariant: 'overcast' as WeatherVariant, expectedPuffs: 7 }
    ];

    for (const { weatherVariant, expectedPuffs } of cases) {
      const { scene, controller } = createController({
        weatherState: 'cloudy',
        weatherVariant,
        daylightHint: 'day'
      });

      try {
        await waitForCloudSky(scene);
        controller.update(frame(1.2));

        const meshes = cloudMeshes(scene.getObjectByName('cloud-sky-system')!);
        const materials = cloudMaterials(scene.getObjectByName('cloud-sky-system')!);

        expect(meshes, weatherVariant).toHaveLength(expectedPuffs);
        expect(materials, weatherVariant).toHaveLength(expectedPuffs);
        expect(new Set(meshes.map((mesh) => mesh.position.toArray().map((value) => value.toFixed(2)).join(','))).size).toBe(expectedPuffs);
        expect(overlappingPairs(meshes), weatherVariant).toEqual([]);
        for (const elapsed of [8, 21, 34, 47]) {
          controller.update(frame(elapsed));
          expect(overlappingPairs(cloudMeshes(scene.getObjectByName('cloud-sky-system')!)), `${weatherVariant}@${elapsed}`).toEqual([]);
        }
        meshes.forEach((mesh) => {
          const aspectRatio = mesh.scale.x / mesh.scale.y;

          expect(aspectRatio, weatherVariant).toBeGreaterThanOrEqual(1.5);
          expect(aspectRatio, weatherVariant).toBeLessThanOrEqual(2.2);
          expect(aspectRatio, weatherVariant).toBeLessThan(3);
        });
        const widths = meshes.map((mesh) => mesh.scale.x);
        const minWidth = Math.min(...widths);
        const maxWidth = Math.max(...widths);

        expect(minWidth, `${weatherVariant} min puff width`).toBeGreaterThan(4.4);
        expect(maxWidth, `${weatherVariant} max puff width`).toBeGreaterThan(5.3);
        expect(maxWidth / minWidth, `${weatherVariant} varied puff sizes`).toBeGreaterThan(1.28);
      } finally {
        controller.dispose();
      }

      expect(scene.children).toHaveLength(0);
    }
  });

  it('uses the figure-two baseline uniforms with only light jitter for ordinary cloud puffs', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene);
      controller.update(frame(1.8));

      const group = scene.getObjectByName('cloud-sky-system')!;
      const meshes = cloudMeshes(group);
      const materials = cloudMaterials(group);
      const positions = new Set(meshes.map((mesh) => mesh.position.toArray().map((value) => value.toFixed(3)).join(',')));
      const scales = new Set(meshes.map((mesh) => mesh.scale.toArray().map((value) => value.toFixed(3)).join(',')));
      const timeValues = new Set(materials.map((material) => material.uniforms.uTime.value.toFixed(3)));
      const driftSeeds = new Set(meshes.map((mesh) => String(mesh.userData.cloudDriftSeed)));

      expect(meshes).toHaveLength(5);
      expect(positions.size).toBe(5);
      expect(scales.size).toBe(5);
      expect(timeValues.size).toBe(5);
      expect(driftSeeds.size).toBe(5);
      materials.forEach((material) => {
        expect(material.uniforms.uFac1.value).toBeGreaterThanOrEqual(17.2);
        expect(material.uniforms.uFac1.value).toBeLessThanOrEqual(18.8);
        expect(material.uniforms.uTimeFactor1.value).toBeGreaterThanOrEqual(0.0018);
        expect(material.uniforms.uTimeFactor1.value).toBeLessThanOrEqual(0.0022);
        expect(material.uniforms.uDisplStrenght1.value).toBeGreaterThanOrEqual(0.036);
        expect(material.uniforms.uDisplStrenght1.value).toBeLessThanOrEqual(0.044);
        expect(material.uniforms.uTimeFactor2.value).toBeGreaterThanOrEqual(0.00135);
        expect(material.uniforms.uTimeFactor2.value).toBeLessThanOrEqual(0.00165);
        expect(material.uniforms.uFac2.value).toBeGreaterThanOrEqual(2.5);
        expect(material.uniforms.uFac2.value).toBeLessThanOrEqual(2.9);
        expect(material.uniforms.uDisplStrenght2.value).toBeGreaterThanOrEqual(0.072);
        expect(material.uniforms.uDisplStrenght2.value).toBeLessThanOrEqual(0.088);
      });
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('keeps cloud puff texture time offsets distinct and advancing across updates', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene);
      controller.update(frame(0.5));

      const firstTimes = cloudMaterials(scene.getObjectByName('cloud-sky-system')!).map(
        (material) => material.uniforms.uTime.value
      );
      controller.update(frame(2.5));
      const nextTimes = cloudMaterials(scene.getObjectByName('cloud-sky-system')!).map(
        (material) => material.uniforms.uTime.value
      );

      expect(firstTimes).toHaveLength(7);
      expect(new Set(firstTimes.map((value) => value.toFixed(3))).size).toBe(7);
      nextTimes.forEach((value, index) => {
        expect(value).toBeGreaterThan(firstTimes[index]);
      });
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('moves each cloud puff across offscreen bounds and loops without an in-screen jump', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene);
      controller.update(frame(0));

      const mesh = cloudMeshes(scene.getObjectByName('cloud-sky-system')!)[0];
      const startX = mesh.position.x;
      const duration = mesh.userData.cloudPuffDuration as number;
      const startOutside = mesh.userData.cloudPuffStartX as number;
      const endOutside = mesh.userData.cloudPuffEndX as number;

      expect(Number.isFinite(duration)).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(60);
      expect(startOutside).toBeLessThan(-mesh.scale.x / 2);
      expect(endOutside).toBeGreaterThan(mesh.scale.x / 2);

      controller.update(frame(duration * 0.25));
      const quarterX = mesh.position.x;
      expect(quarterX).toBeGreaterThan(startX + 0.5);

      controller.update(frame(duration));
      expect(mesh.position.x).toBeCloseTo(startX, 5);
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('does not create or retain dghez cloud meshes outside weatherState cloudy', async () => {
    const cases = [
      { weatherState: 'clear', weatherVariant: 'clear', daylightHint: 'day' },
      { weatherState: 'drizzle', weatherVariant: 'lightRain', daylightHint: 'day' },
      { weatherState: 'rain', weatherVariant: 'moderateRain', daylightHint: 'day' },
      { weatherState: 'heavyRain', weatherVariant: 'heavyRain', daylightHint: 'day' },
      { weatherState: 'storm', weatherVariant: 'thunderstorm', daylightHint: 'day' },
      { weatherState: 'lightSnow', weatherVariant: 'lightSnow', daylightHint: 'day' },
      { weatherState: 'snow', weatherVariant: 'snow', daylightHint: 'day' },
      { weatherState: 'blizzard', weatherVariant: 'heavySnow', daylightHint: 'day' },
      { weatherState: 'fog', weatherVariant: 'mist', daylightHint: 'day' },
      { weatherState: 'sandstorm', weatherVariant: 'dust', daylightHint: 'day' },
      { weatherState: 'aurora', weatherVariant: 'aurora', daylightHint: 'night' }
    ] as const;

    for (const input of cases) {
      const { scene, controller } = createController(input);

      try {
        await settleCloudSystem(scene, controller);

        expect(scene.getObjectByName('cloud-sky-system'), input.weatherState).toBeUndefined();
      } finally {
        controller.dispose();
      }
      expect(scene.children).toHaveLength(0);
    }
  });

  it('clears CloudSkyLayer when weather switches away from cloudy and recreates it when cloudy returns', async () => {
    const { scene, controller } = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene);
      const cloudyGroup = scene.getObjectByName('cloud-sky-system');
      expect(cloudyGroup).toBeDefined();

      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain', daylightHint: 'day' })
      );
      await settleCloudSystem(scene, controller);
      expect(scene.getObjectByName('cloud-sky-system')).toBeUndefined();

      controller.setWeatherProfile(
        getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day' })
      );
      await waitForCloudSky(scene);
      controller.update(frame(0.42));

      const groups = scene.children.filter((child) => child.name === 'cloud-sky-system');
      expect(groups).toHaveLength(1);
      expect(groups[0]).not.toBe(cloudyGroup);
      expect(cloudMeshes(groups[0])).toHaveLength(7);
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('loads CloudSkyLayer lazily through the active cloudy path', () => {
    const cloudSystemSource = readSource('src/modules/weather/systems/CloudSkySystem.ts');
    const atmosphereSource = readSource('src/modules/weather/systems/AtmosphereSystem.ts');
    const layerSource = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');

    expect(cloudSystemSource).toContain("import('./clouds/CloudSkyLayer')");
    expect(cloudSystemSource).toContain('getSkyProfile');
    expect(cloudSystemSource).toContain("profile.weatherState !== 'cloudy'");
    expect(cloudSystemSource).toContain('warnWeatherLayerLoadFailure');
    expect(atmosphereSource).not.toContain("profile.weatherState === 'cloudy'");
    expect(layerSource).not.toContain('CloudBandConfig');
    expect(layerSource).not.toContain('cloudBand');
    expect(layerSource).not.toContain('scene.background');
    expect(layerSource).not.toContain('EffectComposer');
    expect(layerSource).not.toContain('html2canvas');
    expect(layerSource).not.toContain('captureStream');
    expect(layerSource).not.toContain('getDisplayMedia');
    expect(layerSource).not.toContain('tScene');
  });

  it('ports dghez procedural cloud assets, source notice, and shader uniforms', () => {
    const layerSource = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');
    const shaderSource = readSource('src/modules/weather/systems/clouds/cloudShaders.ts');
    const profileSource = readSource('src/modules/weather/systems/clouds/cloudLayerProfiles.ts');

    expect(fileExists('src/modules/weather/effects/clouds/assets/dghez-cloud-shape.webp')).toBe(true);
    expect(fileExists('src/modules/weather/effects/clouds/assets/dghez-cloud-noise.webp')).toBe(true);
    expect(fileExists('src/modules/weather/effects/clouds/LICENSE.dghez-procedural-clouds.txt')).toBe(true);

    [
      'uTxtShape',
      'uTxtCloudNoise',
      'uTime',
      'uFac1',
      'uFac2',
      'uTimeFactor1',
      'uTimeFactor2',
      'uDisplStrenght1',
      'uDisplStrenght2'
    ].forEach((uniformName) => {
      expect(layerSource + shaderSource, uniformName).toContain(uniformName);
    });
    expect(shaderSource).toContain('fbm3d');
    expect(shaderSource).toContain('snoise3');
    expect(shaderSource).toContain('levels');
    expect(shaderSource).toContain('vec3(0.95, 0.95, 0.95)');
    [
      'resolveLayout',
      'resolveInstanceLayout',
      'styleCode',
      'puffyCloud',
      'sheetCloud',
      'wispyCloud',
      'cellularCloud',
      'towerCloud',
      'renderStyle',
      'instanceCount',
      'verticalBias',
      'flatBase',
      'CloudBandConfig',
      'cloudBand'
    ].forEach((legacyToken) => {
      expect(layerSource + shaderSource + profileSource, legacyToken).not.toContain(legacyToken);
    });
  });

  it('uses the same dghez shader path for every cloud genus and disposes textures', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const shaderPaths = new Set<string>();
    const textureDisposeSpies: ReturnType<typeof vi.spyOn>[] = [];
    const materialDisposeSpies: ReturnType<typeof vi.spyOn>[] = [];
    const geometryDisposeSpies: ReturnType<typeof vi.spyOn>[] = [];
    const layers: CloudSkyLayer[] = [];

    ALL_CLOUD_GENERA.forEach((genus) => {
      const skyProfile = skyProfileForGenus(genus);
      const layer = new CloudSkyLayer(scene, camera, skyProfile, cloudLightingFor(skyProfile));
      const group = scene.children[scene.children.length - 1];
      const meshes = cloudMeshes(group!);
      const materials = cloudMaterials(group!);

      expect(meshes, genus).toHaveLength(5);
      expect(materials.length, genus).toBe(meshes.length);
      textureDisposeSpies.push(vi.spyOn(materials[0].uniforms.uTxtShape.value, 'dispose'));
      textureDisposeSpies.push(vi.spyOn(materials[0].uniforms.uTxtCloudNoise.value, 'dispose'));
      materials.forEach((material) => {
        expect(material.uniforms.uTxtShape.value, genus).toBeInstanceOf(THREE.Texture);
        expect(material.uniforms.uTxtCloudNoise.value, genus).toBeInstanceOf(THREE.Texture);
        expect(material.uniforms.styleCode, genus).toBeUndefined();
        shaderPaths.add(material.fragmentShader);
        materialDisposeSpies.push(vi.spyOn(material, 'dispose'));
      });
      meshes.forEach((mesh, index) => {
        expect(mesh.name, genus).toBe(index === 0 ? 'cloud-sky-dghez-cloud' : `cloud-sky-dghez-cloud-${index + 1}`);
        expect(mesh.geometry, genus).toBeInstanceOf(THREE.PlaneGeometry);
        expect((mesh.geometry as THREE.PlaneGeometry).parameters.widthSegments, genus).toBe(5);
        expect((mesh.geometry as THREE.PlaneGeometry).parameters.heightSegments, genus).toBe(5);
      });
      geometryDisposeSpies.push(vi.spyOn(meshes[0].geometry, 'dispose'));
      layers.push(layer);
    });

    expect(shaderPaths.size).toBe(1);
    expect([...shaderPaths][0]).toContain('uTxtShape');

    layers.forEach((layer) => layer.dispose());

    expect(textureDisposeSpies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
    expect(materialDisposeSpies.every((spy) => spy.mock.calls.length > 0)).toBe(true);
    expect(geometryDisposeSpies.every((spy) => spy.mock.calls.length > 0)).toBe(true);
    expect(scene.children).toHaveLength(0);
  });

  it('can be instantiated and disposed independently as a system-owned layer', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const system = new CloudSkySystem({ scene, camera, wind: new WindSystem() });

    try {
      system.setProfile(getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day' }));
      await waitForCloudSky(scene);
      system.update(
        frame(),
        new WeatherController(
          getWeatherProfile({ weatherState: 'cloudy', weatherVariant: 'overcast', daylightHint: 'day' })
        ).runtimeState
      );

      expect(scene.getObjectByName('cloud-sky-system')).toBeDefined();
      expect(cloudMeshes(scene.getObjectByName('cloud-sky-system')!)).toHaveLength(7);
    } finally {
      system.dispose();
    }
    expect(scene.children).toHaveLength(0);
  });

  it('keeps daytime cloudy clouds visible and drifting left to right', async () => {
    const partly = createController({
      weatherState: 'cloudy',
      weatherVariant: 'partlyCloudy',
      daylightHint: 'day'
    });
    const overcast = createController({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(partly.scene);
      await waitForCloudSky(overcast.scene);

      partly.controller.update(frame(0.2));
      overcast.controller.update(frame(0.2));
      const partlyMeshes = cloudMeshes(partly.scene.getObjectByName('cloud-sky-system')!);
      const overcastMeshes = cloudMeshes(overcast.scene.getObjectByName('cloud-sky-system')!);
      const partlyMeshStart = partlyMeshes[0].position.x;
      const overcastMeshStart = overcastMeshes[0].position.x;

      partly.controller.update(frame(5.2, 0.16));
      overcast.controller.update(frame(5.2, 0.16));

      const partlyMaterials = cloudMaterials(partly.scene.getObjectByName('cloud-sky-system')!);
      const overcastMaterials = cloudMaterials(overcast.scene.getObjectByName('cloud-sky-system')!);
      const partlyAverageOpacity =
        partlyMaterials.reduce((sum, material) => sum + material.uniforms.uOpacity.value, 0) / partlyMaterials.length;
      const overcastAverageOpacity =
        overcastMaterials.reduce((sum, material) => sum + material.uniforms.uOpacity.value, 0) / overcastMaterials.length;
      const partlyMeshEnd = partlyMeshes[0].position.x;
      const overcastMeshEnd = overcastMeshes[0].position.x;

      expect(partlyMeshes).toHaveLength(5);
      expect(overcastMeshes).toHaveLength(7);
      expect(overlappingPairs(partlyMeshes)).toEqual([]);
      expect(overlappingPairs(overcastMeshes)).toEqual([]);
      expect(Math.min(...partlyMaterials.map((material) => material.uniforms.uOpacity.value))).toBeGreaterThan(0.6);
      expect(partlyAverageOpacity).toBeGreaterThanOrEqual(overcastAverageOpacity * 0.72);
      expect(partlyAverageOpacity).toBeLessThan(overcastAverageOpacity);
      expect(partlyMaterials[0].uniforms.uBrightness.value).toBeGreaterThan(0.95);
      expect(partlyMaterials[0].uniforms.uTime.value).toBeGreaterThan(250);
      expect(partlyMeshEnd).toBeGreaterThan(partlyMeshStart);

      expect(overcastMaterials[0].uniforms.uOpacity.value).toBeGreaterThan(0.65);
      expect(overcastMaterials[0].uniforms.uBrightness.value).toBeGreaterThan(0.95);
      expect(overcastMeshEnd).toBeGreaterThan(overcastMeshStart);
    } finally {
      partly.controller.dispose();
      overcast.controller.dispose();
    }

    expect(partly.scene.children).toHaveLength(0);
    expect(overcast.scene.children).toHaveLength(0);
  });

  it('does not use dghez cloud meshes for storm or hailStorm', async () => {
    const storm = createController({
      weatherState: 'storm',
      weatherVariant: 'thunderstorm',
      daylightHint: 'day'
    });
    const hailStorm = createController({
      weatherState: 'storm',
      weatherVariant: 'hailStorm',
      precipitationKind: 'hail',
      daylightHint: 'day'
    });

    try {
      await settleCloudSystem(storm.scene, storm.controller);
      await settleCloudSystem(hailStorm.scene, hailStorm.controller);

      expect(storm.scene.getObjectByName('cloud-sky-system')).toBeUndefined();
      expect(hailStorm.scene.getObjectByName('cloud-sky-system')).toBeUndefined();
    } finally {
      storm.controller.dispose();
      hailStorm.controller.dispose();
    }

    expect(storm.scene.children).toHaveLength(0);
    expect(hailStorm.scene.children).toHaveLength(0);
  });

  it('keeps long-running dghez clouds animated without relying on old shape branches', async () => {
    const shaderSource = readSource('src/modules/weather/systems/clouds/cloudShaders.ts');
    const scene = createController({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      daylightHint: 'day'
    });

    expect(shaderSource).toContain('uTxtShape');
    expect(shaderSource).toContain('uTxtCloudNoise');
    expect(shaderSource).not.toContain('styleCode');

    try {
      await waitForCloudSky(scene.scene);
      scene.controller.update(frame(86_400, 0.16));

      const material = cloudMaterials(scene.scene.getObjectByName('cloud-sky-system')!)[0];
      const mesh = firstCloudMesh(scene.scene.getObjectByName('cloud-sky-system')!);

      expect(cloudMeshes(scene.scene.getObjectByName('cloud-sky-system')!)).toHaveLength(7);
      expect(material.uniforms.uTime.value).toBeGreaterThan(1000);
      expect(material.uniforms.uTxtShape.value).toBeInstanceOf(THREE.Texture);
      expect(Number.isFinite(mesh.position.x)).toBe(true);
      expect(Number.isFinite(mesh.scale.x)).toBe(true);
      expect(mesh.scale.x / mesh.scale.y).toBeGreaterThanOrEqual(1.5);
      expect(mesh.scale.x / mesh.scale.y).toBeLessThanOrEqual(2.2);
    } finally {
      scene.controller.dispose();
    }

    expect(scene.scene.children).toHaveLength(0);
  });

  it('renders overcast with dghez cloud textures instead of old sheet-cloud edge fades', async () => {
    const scene = createController({
      weatherState: 'cloudy',
      weatherVariant: 'overcast',
      daylightHint: 'day'
    });

    try {
      await waitForCloudSky(scene.scene);
      scene.controller.update(frame(86_400, 0.16));

      const cloudGroup = scene.scene.getObjectByName('cloud-sky-system')!;
      const meshes = cloudMeshes(cloudGroup);
      const cloud = cloudMesh(cloudGroup, 'cloud-sky-dghez-cloud');
      const geometry = cloud.geometry as THREE.PlaneGeometry;
      const material = cloud.material as THREE.ShaderMaterial;

      expect(meshes).toHaveLength(7);
      expect(geometry.parameters.widthSegments).toBe(5);
      expect(geometry.parameters.heightSegments).toBe(5);
      expect(material.uniforms.uTxtShape.value).toBeInstanceOf(THREE.Texture);
      expect(material.uniforms.uTxtCloudNoise.value).toBeInstanceOf(THREE.Texture);
      expect(material.uniforms.uOpacity.value).toBeGreaterThan(0.38);
      expect(readSource('src/modules/weather/systems/clouds/cloudShaders.ts')).not.toContain('sheetCloud');
    } finally {
      scene.controller.dispose();
    }

    expect(scene.scene.children).toHaveLength(0);
  });

  it('removes dghez demo controls and keeps production cloud behavior free of banned APIs', () => {
    const weatherAtmosphereSource = readSource('src/modules/weather/WeatherAtmosphere.vue');
    const threeLayerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');
    const systemSource = readSource('src/modules/weather/systems/CloudSkySystem.ts');
    const layerSource = readSource('src/modules/weather/systems/clouds/CloudSkyLayer.ts');
    const combined = weatherAtmosphereSource + threeLayerSource + systemSource + layerSource;

    expect(fileExists('src/modules/weather/systems/clouds/CloudSkyBackgroundLayer.ts')).toBe(false);
    expect(fileExists('src/modules/weather/systems/clouds/CloudSkyDebugControls.ts')).toBe(false);
    expect(fileExists('src/modules/weather/systems/clouds/cloudBackgroundShaders.ts')).toBe(false);
    expect(weatherAtmosphereSource).not.toContain('cloudDemo');
    expect(weatherAtmosphereSource).not.toContain('cloudControls');
    expect(threeLayerSource).not.toContain('cloudDemoMode');
    expect(systemSource).not.toContain('cloudDemoMode');
    expect(layerSource).not.toContain('cloudControls');
    expect(combined).not.toContain('EffectComposer');
    expect(combined).not.toContain('html2canvas');
    expect(combined).not.toContain('captureStream');
    expect(combined).not.toContain('getDisplayMedia');
    expect(combined).not.toContain('scene.background');
    expect(combined).not.toMatch(/uniform\s+sampler2D\s+tScene/);
    expect(combined).not.toMatch(/uniform\s+sampler2D\s+tInput/);
  });
});
