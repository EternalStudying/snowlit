import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ThreeWeatherLayer from '../components/ThreeWeatherLayer.vue';
import { WeatherController } from '../core/WeatherController';
import { WEATHER_CLOUD_BUDGET, WEATHER_LIGHTNING_BUDGET, WEATHER_METEOR_BUDGET, WEATHER_NIGHT_SKY_BUDGET, WEATHER_PARTICLE_COUNTS, WEATHER_PERFORMANCE_BUDGET, WEATHER_PIXEL_RATIO_CAP, WEATHER_RENDERABLE_BUDGET } from '../core/weatherPerformanceBudget';
import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { WindSystem } from '../core/WindSystem';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { LightningLayer } from '../systems/electrical/LightningLayer';

const rendererMock = vi.hoisted(() => {
  const renderer = {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    setAnimationLoop: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    outputColorSpace: undefined as unknown,
    toneMapping: undefined as unknown,
    toneMappingExposure: 0
  };
  const createWeatherRenderer = vi.fn(async () => ({
    rendererKind: 'webgl' as const,
    gpuAvailable: false,
    renderer
  }));

  return { renderer, createWeatherRenderer };
});

vi.mock('../core/createWeatherRenderer', () => ({
  createWeatherRenderer: rendererMock.createWeatherRenderer
}));

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function renderableCount(scene: THREE.Scene) {
  let count = 0;

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      count += 1;
    }
  });

  return count;
}

function collectRenderables(scene: THREE.Scene) {
  const renderables: Array<THREE.Mesh | THREE.Points | THREE.LineSegments> = [];

  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      renderables.push(object);
    }
  });

  return renderables;
}

const frame = (elapsed = 0.24, delta = 0.16): WeatherFrameState => ({
  elapsed,
  delta,
  pointer: { x: 0.04, y: -0.02 },
  scrollY: 24
});

async function waitForAsyncWeather() {
  const deadline = Date.now() + 250;

  while (Date.now() < deadline) {
    await Promise.resolve();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));
  }
}

async function waitForRendererAnimationLoop() {
  for (let index = 0; index < 30; index += 1) {
    await flushPromises();
    await new Promise((resolveWait) => setTimeout(resolveWait, 0));

    const lastCall = rendererMock.renderer.setAnimationLoop.mock.calls.at(-1);

    if (typeof lastCall?.[0] === 'function') {
      return;
    }
  }
}

async function createControllerScene(input: Parameters<typeof getWeatherProfile>[0]) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 6);
  const controller = new WeatherController(getWeatherProfile(input), new WindSystem(), { scene, camera });

  await waitForAsyncWeather();
  controller.update(frame());

  return { scene, camera, controller };
}

describe('procedural-weather stage 7 performance and degradation hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    rendererMock.renderer.setSize.mockClear();
    rendererMock.renderer.setPixelRatio.mockClear();
    rendererMock.renderer.setClearColor.mockClear();
    rendererMock.renderer.setAnimationLoop.mockClear();
    rendererMock.renderer.render.mockClear();
    rendererMock.renderer.dispose.mockClear();
    rendererMock.createWeatherRenderer.mockClear();
  });

  it('centralizes weather performance budgets and particle counts', () => {
    expect(WEATHER_PIXEL_RATIO_CAP).toBeLessThanOrEqual(2);
    expect(WEATHER_PARTICLE_COUNTS.rain).toBeGreaterThanOrEqual(WEATHER_PERFORMANCE_BUDGET.rain.min);
    expect(WEATHER_PARTICLE_COUNTS.rain).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.rain.max);
    expect(WEATHER_PARTICLE_COUNTS.snow.blizzard).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.snow.max);
    expect(WEATHER_PARTICLE_COUNTS.hail.hail).toBeGreaterThanOrEqual(WEATHER_PERFORMANCE_BUDGET.hail.min);
    expect(WEATHER_PARTICLE_COUNTS.hail.hail).toBeLessThanOrEqual(1800);
    expect(WEATHER_PARTICLE_COUNTS.hail.hailStorm).toBeGreaterThan(WEATHER_PARTICLE_COUNTS.hail.hail);
    expect(WEATHER_PARTICLE_COUNTS.hail.hailStorm).toBeLessThanOrEqual(3600);
    expect(WEATHER_PARTICLE_COUNTS.hail.hailStorm).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.hail.max);
    expect(WEATHER_PARTICLE_COUNTS.sand.sandstorm).toBeGreaterThan(WEATHER_PARTICLE_COUNTS.sand.dust);
    expect(WEATHER_PARTICLE_COUNTS.sand.sandstorm).toBeLessThanOrEqual(WEATHER_PARTICLE_COUNTS.sand.dust + 4000);
    expect(WEATHER_PARTICLE_COUNTS.sand.sandstorm).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.sand.max);
    expect(WEATHER_PARTICLE_COUNTS.rainSplash).toBeGreaterThanOrEqual(WEATHER_PERFORMANCE_BUDGET.splash.min);
    expect(WEATHER_PARTICLE_COUNTS.rainSplash).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.splash.max);
    expect(WEATHER_PARTICLE_COUNTS.sunnyDust).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.sunnyDust.max);
    expect(WEATHER_PARTICLE_COUNTS.auroraStars).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.auroraStars.max);
    expect(WEATHER_NIGHT_SKY_BUDGET.maxStars).toBeLessThanOrEqual(WEATHER_PERFORMANCE_BUDGET.nightSkyStars.max);
    expect(WEATHER_NIGHT_SKY_BUDGET.maxRenderableMeshes).toBeLessThanOrEqual(7);
    expect(WEATHER_NIGHT_SKY_BUDGET.maxMoonMeshes).toBeLessThanOrEqual(2);
    expect(WEATHER_LIGHTNING_BUDGET.maxActiveBolts).toBeLessThanOrEqual(3);
    expect(WEATHER_METEOR_BUDGET.maxActiveMeteors).toBeLessThanOrEqual(4);
    expect(WEATHER_METEOR_BUDGET.maxRenderableMeshes).toBeLessThanOrEqual(2);
    expect(WEATHER_CLOUD_BUDGET.maxRenderableMeshes).toBeLessThanOrEqual(7);
    expect(WEATHER_CLOUD_BUDGET.maxGeneraPerSky).toBeLessThanOrEqual(2);
    expect(WEATHER_CLOUD_BUDGET.maxInstances).toBeLessThanOrEqual(128);
  });

  it('keeps renderable object counts inside the family budget', async () => {
    const cases: Array<[keyof typeof WEATHER_RENDERABLE_BUDGET, Parameters<typeof getWeatherProfile>[0]]> = [
      ['clear', { weatherState: 'clear', weatherVariant: 'clear' }],
      ['cloudy', { weatherState: 'cloudy', weatherVariant: 'overcast' }],
      ['rain', { weatherState: 'rain', weatherVariant: 'moderateRain' }],
      ['storm', { weatherState: 'storm', weatherVariant: 'thunderstorm' }],
      ['snow', { weatherState: 'snow', weatherVariant: 'snow' }],
      ['blizzard', { weatherState: 'blizzard', weatherVariant: 'heavySnow' }],
      ['fog', { weatherState: 'fog', weatherVariant: 'mist' }],
      ['sandstorm', { weatherState: 'sandstorm', weatherVariant: 'sandstorm' }],
      ['aurora', { weatherState: 'aurora', weatherVariant: 'aurora' }]
    ];

    for (const [family, profileInput] of cases) {
      const { scene, controller } = await createControllerScene(profileInput);

      try {
        expect(renderableCount(scene), family).toBeLessThanOrEqual(WEATHER_RENDERABLE_BUDGET[family]);
      } finally {
        controller.dispose();
      }
      expect(scene.children).toHaveLength(0);
    }
  });

  it('keeps per-frame particle work in shaders and preserves transparent renderable flags', async () => {
    const { scene, controller } = await createControllerScene({
      weatherState: 'sandstorm',
      weatherVariant: 'sandstorm'
    });

    try {
      collectRenderables(scene).forEach((object) => {
        expect(object.frustumCulled, object.name).toBe(false);
        const material = object.material as THREE.Material | THREE.Material[];
        const materials = Array.isArray(material) ? material : [material];

        materials.forEach((item) => expect(item.depthWrite, object.name).toBe(false));
      });
    } finally {
      controller.dispose();
    }

  });

  it('caps active lightning bolts to the transient budget', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    const layer = new LightningLayer(
      scene,
      camera,
      getWeatherProfile({ weatherState: 'storm', weatherVariant: 'thunderstorm' })
    );
    const harness = layer as unknown as { strike(stormIntensity: number): void; bolts: unknown[] };

    for (let index = 0; index < WEATHER_LIGHTNING_BUDGET.maxActiveBolts + 4; index += 1) {
      harness.strike(1);
    }

    expect(harness.bolts.length).toBeLessThanOrEqual(WEATHER_LIGHTNING_BUDGET.maxActiveBolts);
    expect(renderableCount(scene)).toBeLessThanOrEqual(WEATHER_RENDERABLE_BUDGET.stormBurst);
    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it('does not leave stale resources after rapid profile switches', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, 6);
    const controller = new WeatherController(
      getWeatherProfile({ weatherState: 'rain', weatherVariant: 'moderateRain' }),
      new WindSystem(),
      { scene, camera }
    );

    controller.setWeatherProfile(getWeatherProfile({ weatherState: 'snow', weatherVariant: 'snow' }));
    controller.setWeatherProfile(getWeatherProfile({ weatherState: 'sandstorm', weatherVariant: 'sandstorm' }));
    controller.setWeatherProfile(getWeatherProfile({ weatherState: 'aurora', weatherVariant: 'aurora' }));
    controller.setWeatherProfile(getWeatherProfile({ weatherState: 'clear', weatherVariant: 'clear' }));

    await waitForAsyncWeather();
    controller.update(frame(0.48));

    try {
      const topLevelNames = scene.children.map((child) => child.name);
      expect(topLevelNames).toContain('weather-environment-system');
      expect(topLevelNames).toContain('sunny-optical-system');
      expect(topLevelNames).toContain('rainbow-optical-system');
      expect(topLevelNames).not.toContain('rain-precipitation-system');
      expect(topLevelNames).not.toContain('snow-precipitation-system');
      expect(topLevelNames).not.toContain('dust-atmosphere-system');
      expect(topLevelNames).not.toContain('aurora-optical-system');
    } finally {
      controller.dispose();
    }

    expect(scene.children).toHaveLength(0);
  });

  it('pauses the animation loop while the page is hidden and resumes with a reset frame time', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });

    const wrapper = mount(ThreeWeatherLayer, {
      props: {
        weatherState: 'clear',
        weather: {
          city: '示例城市 A',
          district: '米特区',
          province: '示例地区 A',
          country: '德国',
          weatherState: 'clear',
          weatherVariant: 'clear',
          precipitationKind: 'none',
          daylightHint: 'day',
          temperature: 20,
          rawWeather: '晴',
          windDirection: '东',
          windPower: '2',
          humidity: '48',
          observedAt: '2026-05-13T00:00:00+02:00'
        }
      }
    });

    try {
      await waitForRendererAnimationLoop();
      expect(rendererMock.renderer.setAnimationLoop).toHaveBeenLastCalledWith(expect.any(Function));

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(rendererMock.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(rendererMock.renderer.setAnimationLoop).toHaveBeenLastCalledWith(expect.any(Function));

      const layerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');
      expect(layerSource).toContain('MAX_FRAME_DELTA_SECONDS');
      expect(layerSource).toContain('stopAnimationLoop()');
      expect(layerSource).toContain('startAnimationLoop()');
      expect(layerSource).toContain('isLayerDisposed');

      wrapper.unmount();
    } finally {
      wrapper.unmount();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    }
    expect(rendererMock.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(rendererMock.renderer.dispose).toHaveBeenCalled();
  });
});
