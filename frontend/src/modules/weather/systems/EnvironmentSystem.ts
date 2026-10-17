import * as THREE from 'three';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

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
  private readonly activeLayers = new Map<EnvironmentLayerKey, WeatherSystemLayer>();
  private activeLayer: WeatherSystemLayer | null = null;
  private loadToken = 0;
  private disposed = false;
  private profile: WeatherProfile | null = null;

  constructor(private readonly context?: WeatherSystemContext) {
    this.group.name = 'weather-environment-system';
    this.keyLight.position.set(-4.4, 5.2, 3.4);
    this.group.add(this.ambientLight, this.keyLight);
    this.context?.scene.add(this.group);
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const keys = resolveEnvironmentLayerKeys(profile);

    if (!this.context || keys.length === 0) {
      this.clearLayers();
      return;
    }

    this.retainLayerKeys(keys);
    this.activeLayers.forEach((layer) => layer.setProfile(profile));
    const token = ++this.loadToken;
    keys.forEach((key) => {
      if (!this.activeLayers.has(key)) {
        void this.loadLayer(key, token);
      }
    });
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
    this.activeLayers.forEach((layer) => layer.update(frame, runtime));
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayers();

    if (!this.context) {
      return;
    }

    this.group.removeFromParent();
    this.group.clear();
    this.profile = null;
  }

  private retainLayerKeys(keys: EnvironmentLayerKey[]) {
    this.activeLayers.forEach((layer, key) => {
      if (!keys.includes(key)) {
        layer.dispose();
        this.activeLayers.delete(key);
      }
    });
  }

  private async loadLayer(key: EnvironmentLayerKey, token: number) {
    const profile = this.profile;

    if (!this.isLayerRequestActive(key, token, profile)) {
      return;
    }

    let layer: WeatherSystemLayer;

    try {
      if (key === 'wet-surface') {
        const { WetSurfaceLayer } = await import('./environment/WetSurfaceLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new WetSurfaceLayer(this.context!.scene, this.context!.camera, profile);
      } else if (key === 'snow-accumulation') {
        const { SnowAccumulationLayer } = await import('./environment/SnowAccumulationLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new SnowAccumulationLayer(this.context!.scene, this.context!.camera, profile);
      } else {
        const { SandstormTintLayer } = await import('./environment/SandstormTintLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new SandstormTintLayer(this.context!.scene, this.context!.camera, profile);
      }
    } catch (error) {
      warnWeatherLayerLoadFailure('EnvironmentSystem', error);
      return;
    }

    if (!this.isLayerRequestActive(key, token, profile)) {
      layer.dispose();
      return;
    }

    this.activeLayers.set(key, layer);
    this.activeLayer = layer;
    layer.setProfile(this.profile ?? profile);
  }

  private isLayerRequestActive(key: EnvironmentLayerKey, token: number, profile: WeatherProfile | null): profile is WeatherProfile {
    return Boolean(
      this.context &&
        profile &&
        !this.disposed &&
        token === this.loadToken &&
        this.profile &&
        resolveEnvironmentLayerKeys(this.profile).includes(key)
    );
  }

  private clearLayers() {
    this.activeLayers.forEach((layer) => layer.dispose());
    this.activeLayers.clear();
    this.activeLayer = null;
  }
}
