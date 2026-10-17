import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

type OpticalLayerKey = 'sunny' | 'rainbow' | 'wet-lens' | 'frost' | 'aurora';

const RAIN_FAMILY_STATES = new Set(['drizzle', 'rain', 'heavyRain', 'storm']);
const SNOW_FAMILY_STATES = new Set(['lightSnow', 'snow', 'blizzard']);

function resolveOpticalLayerKeys(profile: WeatherProfile): OpticalLayerKey[] {
  if (profile.weatherState === 'clear') {
    if (profile.daylightHint === 'night') {
      return [];
    }

    return ['sunny', 'rainbow'];
  }

  if (RAIN_FAMILY_STATES.has(profile.weatherState)) {
    return ['wet-lens'];
  }

  if (SNOW_FAMILY_STATES.has(profile.weatherState)) {
    return ['frost'];
  }

  if (profile.weatherState === 'aurora') {
    return ['aurora'];
  }

  return [];
}

export class OpticalSystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private readonly activeLayers = new Map<OpticalLayerKey, WeatherSystemLayer>();
  private activeLayer: WeatherSystemLayer | null = null;
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const keys = resolveOpticalLayerKeys(profile);

    if (!this.context) {
      this.clearLayers();
      return;
    }

    if (keys.length === 0) {
      if (this.activeLayers.size === 0) {
        this.clearLayers();
        return;
      }

      this.activeLayers.forEach((layer) => layer.setProfile(profile));
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
    const sunnyOpticalVisibility = runtime.orchestration.sunnyOpticalVisibility;
    const auroraVisibility = runtime.orchestration.auroraVisibility;
    this.activeLayers.forEach((layer) => layer.update(frame, runtime));

    if (runtime.transitionProgress >= 1 && sunnyOpticalVisibility <= 0.01 && auroraVisibility <= 0.01 && this.profile) {
      this.retainLayerKeys(resolveOpticalLayerKeys(this.profile));
    }
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayers();
    this.profile = null;
  }

  private retainLayerKeys(keys: OpticalLayerKey[]) {
    this.activeLayers.forEach((layer, key) => {
      if (!keys.includes(key)) {
        layer.dispose();
        this.activeLayers.delete(key);
      }
    });
  }

  private async loadLayer(key: OpticalLayerKey, token: number) {
    const profile = this.profile;

    if (!this.isLayerRequestActive(key, token, profile)) {
      return;
    }

    let layer: WeatherSystemLayer;

    try {
      if (key === 'sunny') {
        const { SunnyOpticalLayer } = await import('./optical/SunnyOpticalLayer');
        const activeProfile = this.getActiveProfileForLayer(key, token);
        if (!activeProfile || !this.context) {
          return;
        }
        layer = new SunnyOpticalLayer(this.context.scene, this.context.camera, this.context.wind, activeProfile);
      } else if (key === 'rainbow') {
        const { RainbowOpticalLayer } = await import('./optical/RainbowOpticalLayer');
        const activeProfile = this.getActiveProfileForLayer(key, token);
        if (!activeProfile || !this.context) {
          return;
        }
        layer = new RainbowOpticalLayer(this.context.scene, this.context.camera, activeProfile);
      } else if (key === 'wet-lens') {
        const { WetLensOverlayLayer } = await import('./optical/WetLensOverlayLayer');
        const activeProfile = this.getActiveProfileForLayer(key, token);
        if (!activeProfile || !this.context) {
          return;
        }
        layer = new WetLensOverlayLayer(this.context.scene, this.context.camera, activeProfile);
      } else if (key === 'frost') {
        const { FrostOverlayLayer } = await import('./optical/FrostOverlayLayer');
        const activeProfile = this.getActiveProfileForLayer(key, token);
        if (!activeProfile || !this.context) {
          return;
        }
        layer = new FrostOverlayLayer(this.context.scene, this.context.camera, activeProfile);
      } else {
        const { AuroraOpticalLayer } = await import('./optical/AuroraOpticalLayer');
        const activeProfile = this.getActiveProfileForLayer(key, token);
        if (!activeProfile || !this.context) {
          return;
        }
        layer = new AuroraOpticalLayer(this.context.scene, this.context.camera, activeProfile);
      }
    } catch (error) {
      warnWeatherLayerLoadFailure('OpticalSystem', error);
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

  private getActiveProfileForLayer(key: OpticalLayerKey, token: number) {
    if (!this.isLayerRequestActive(key, token, this.profile)) {
      return null;
    }

    const activeProfile = this.profile;
    return activeProfile;
  }

  private isLayerRequestActive(key: OpticalLayerKey, token: number, profile: WeatherProfile | null): profile is WeatherProfile {
    return Boolean(
      this.context &&
        profile &&
        !this.disposed &&
        token === this.loadToken &&
        this.profile &&
        resolveOpticalLayerKeys(this.profile).includes(key)
    );
  }

  private clearLayers() {
    this.activeLayers.forEach((layer) => layer.dispose());
    this.activeLayers.clear();
    this.activeLayer = null;
  }
}
