import * as THREE from 'three';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { LazyLayers } from './LazyLayers';

type EnvironmentLayerKey = 'wet-surface' | 'snow-accumulation' | 'sandstorm-tint';

const RAIN_FAMILY_STATES = new Set(['drizzle', 'rain', 'heavyRain', 'storm']);
const SNOW_FAMILY_STATES = new Set(['lightSnow', 'snow', 'blizzard']);

function resolveEnvironmentLayerKeys(profile: WeatherProfile): EnvironmentLayerKey[] {
  if (RAIN_FAMILY_STATES.has(profile.weatherState)) {
    return ['wet-surface'];
  }

  if (SNOW_FAMILY_STATES.has(profile.weatherState)) {
    return ['snow-accumulation'];
  }

  if (profile.weatherState === 'sandstorm') {
    return ['sandstorm-tint'];
  }

  return [];
}

export class EnvironmentSystem implements WeatherSystem {
  private readonly group = new THREE.Group();
  private readonly ambientLight = new THREE.HemisphereLight(0xffedc4, 0x6f7d96, 0);
  private readonly keyLight = new THREE.DirectionalLight(0xffdea3, 0);
  private profile: WeatherProfile | null = null;
  private readonly layers = new LazyLayers<EnvironmentLayerKey, WeatherSystemLayer>(
    'EnvironmentSystem',
    (key) => this.loadLayer(key),
    (layer) => layer.setProfile(this.profile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {
    this.group.name = 'weather-environment-system';
    this.keyLight.position.set(-4.4, 5.2, 3.4);
    this.group.add(this.ambientLight, this.keyLight);
    this.context?.scene.add(this.group);
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.layers.show(this.context ? resolveEnvironmentLayerKeys(profile) : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    if (!this.context) {
      return;
    }

    const warmth = runtime.ambientWarmth;
    const readableDarkness =
      (1 - runtime.skyDarkness * 0.34) * (1 - runtime.orchestration.environmentDarknessMultiplier * 0.22);
    const warmSky = new THREE.Color(0xffedc4).convertSRGBToLinear();
    const coolSky = new THREE.Color(0xaec4dc).convertSRGBToLinear();
    const warmGround = new THREE.Color(0xffd8a8).convertSRGBToLinear();
    const coolGround = new THREE.Color(0x566778).convertSRGBToLinear();
    const sunWarm = new THREE.Color(0xffdea3).convertSRGBToLinear();
    const sunCool = new THREE.Color(0x9fb5d0).convertSRGBToLinear();

    this.ambientLight.color.copy(coolSky).lerp(warmSky, Math.min(warmth, 1));
    this.ambientLight.groundColor.copy(coolGround).lerp(warmGround, Math.min(warmth, 1));
    this.ambientLight.intensity = (0.22 + warmth * 0.38) * readableDarkness;
    this.keyLight.color.copy(sunCool).lerp(sunWarm, Math.min(warmth, 1));
    this.keyLight.intensity = (0.38 + warmth * 1.08) * readableDarkness;
    this.layers.update(frame, runtime);
  }

  dispose() {
    this.layers.dispose();
    this.group.removeFromParent();
    this.group.clear();
    this.profile = null;
  }

  private async loadLayer(key: EnvironmentLayerKey): Promise<() => WeatherSystemLayer> {
    const { scene, camera } = this.context!;
    if (key === 'wet-surface') {
      const { WetSurfaceLayer } = await import('./environment/WetSurfaceLayer');
      return () => new WetSurfaceLayer(scene, camera, this.profile!);
    }
    if (key === 'snow-accumulation') {
      const { SnowAccumulationLayer } = await import('./environment/SnowAccumulationLayer');
      return () => new SnowAccumulationLayer(scene, camera, this.profile!);
    }
    const { SandstormTintLayer } = await import('./environment/SandstormTintLayer');
    return () => new SandstormTintLayer(scene, camera, this.profile!);
  }
}
