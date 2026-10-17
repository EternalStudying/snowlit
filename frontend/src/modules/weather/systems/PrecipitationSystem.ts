import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

type PrecipitationMode = 'rain' | 'snow';
type PrecipitationLayerKey = 'rain' | 'snow' | 'hail' | 'rain-splash';

const RAIN_FAMILY_STATES = new Set(['drizzle', 'rain', 'heavyRain', 'storm']);
const SNOW_FAMILY_STATES = new Set(['lightSnow', 'snow', 'blizzard']);

function isHailProfile(profile: WeatherProfile) {
  return (
    profile.precipitationKind === 'hail' ||
    profile.weatherVariant === 'hail' ||
    profile.weatherVariant === 'hailStorm'
  );
}

function resolvePrecipitationMode(profile: WeatherProfile): PrecipitationMode | 'hail' | null {
  if (isHailProfile(profile)) {
    return 'hail';
  }

  if (RAIN_FAMILY_STATES.has(profile.weatherState)) {
    return 'rain';
  }

  if (SNOW_FAMILY_STATES.has(profile.weatherState)) {
    return 'snow';
  }

  return null;
}

export class PrecipitationSystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private activeMode: PrecipitationMode | 'hail' | null = null;
  private activeLayer: WeatherSystemLayer | null = null;
  private readonly activeLayers = new Map<PrecipitationLayerKey, WeatherSystemLayer>();
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolvePrecipitationMode(profile);

    if (!this.context || !mode) {
      this.clearLayers();
      this.activeMode = null;
      return;
    }

    const nextKeys = this.resolveLayerKeys(mode);

    if (mode === this.activeMode) {
      this.retainLayerKeys(nextKeys);
      this.activeLayers.forEach((layer) => layer.setProfile(profile));
      return;
    }

    this.clearLayers();
    this.activeMode = mode;
    const token = ++this.loadToken;
    nextKeys.forEach((key) => void this.loadLayer(key, token));
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const precipitationVisibility = runtime.orchestration.precipitationVisibility;
    const effectiveRuntime = {
      ...runtime,
      rainIntensity: runtime.rainIntensity * precipitationVisibility,
      snowIntensity: runtime.snowIntensity * precipitationVisibility,
      particleIntensity: runtime.particleIntensity * precipitationVisibility
    };

    this.activeLayers.forEach((layer) => layer.update(frame, effectiveRuntime));
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayers();
    this.profile = null;
    this.activeMode = null;
  }

  private resolveLayerKeys(mode: PrecipitationMode | 'hail'): PrecipitationLayerKey[] {
    if (mode === 'hail') {
      return ['hail'];
    }

    if (mode === 'rain') {
      return ['rain', 'rain-splash'];
    }

    return ['snow'];
  }

  private retainLayerKeys(keys: PrecipitationLayerKey[]) {
    this.activeLayers.forEach((layer, key) => {
      if (!keys.includes(key)) {
        layer.dispose();
        this.activeLayers.delete(key);
      }
    });

    if (this.context) {
      const token = ++this.loadToken;
      keys.forEach((key) => {
        if (!this.activeLayers.has(key)) {
          void this.loadLayer(key, token);
        }
      });
    }
  }

  private async loadLayer(key: PrecipitationLayerKey, token: number) {
    const profile = this.profile;

    if (!this.isLayerRequestActive(key, token, profile)) {
      return;
    }

    let layer: WeatherSystemLayer;

    try {
      if (key === 'rain') {
        const { RainPrecipitationLayer } = await import('./precipitation/RainPrecipitationLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new RainPrecipitationLayer(this.context!.scene, this.context!.camera, this.context!.wind, profile);
      } else if (key === 'rain-splash') {
        const { RainSplashLayer } = await import('./precipitation/RainSplashLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new RainSplashLayer(this.context!.scene, this.context!.camera, profile);
      } else if (key === 'hail') {
        const { HailPrecipitationLayer } = await import('./precipitation/HailPrecipitationLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new HailPrecipitationLayer(this.context!.scene, this.context!.camera, this.context!.wind, profile);
      } else {
        const { SnowPrecipitationLayer } = await import('./precipitation/SnowPrecipitationLayer');

        if (!this.isLayerRequestActive(key, token, profile)) {
          return;
        }

        layer = new SnowPrecipitationLayer(this.context!.scene, this.context!.camera, this.context!.wind, profile);
      }
    } catch (error) {
      warnWeatherLayerLoadFailure('PrecipitationSystem', error);
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

  private isLayerRequestActive(key: PrecipitationLayerKey, token: number, profile: WeatherProfile | null): profile is WeatherProfile {
    return Boolean(
      this.context &&
        profile &&
        !this.disposed &&
        token === this.loadToken &&
        this.activeMode &&
        this.resolveLayerKeys(this.activeMode).includes(key)
    );
  }

  private clearLayers() {
    this.activeLayers.forEach((layer) => layer.dispose());
    this.activeLayers.clear();
    this.activeLayer = null;
  }
}
