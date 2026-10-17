import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

type AtmosphereMode = 'rain-haze' | 'snow-veil' | 'fog' | 'dust';

const RAIN_FAMILY_STATES = new Set(['drizzle', 'rain', 'heavyRain', 'storm']);
const SNOW_FAMILY_STATES = new Set(['lightSnow', 'snow', 'blizzard']);

function resolveAtmosphereMode(profile: WeatherProfile): AtmosphereMode | null {
  if (RAIN_FAMILY_STATES.has(profile.weatherState)) {
    return 'rain-haze';
  }

  if (SNOW_FAMILY_STATES.has(profile.weatherState)) {
    return 'snow-veil';
  }

  if (profile.weatherState === 'fog') {
    return 'fog';
  }

  if (profile.weatherState === 'sandstorm') {
    return 'dust';
  }

  return null;
}

export class AtmosphereSystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private activeMode: AtmosphereMode | null = null;
  private activeLayer: WeatherSystemLayer | null = null;
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolveAtmosphereMode(profile);

    if (!this.context || !mode) {
      this.clearLayer();
      this.activeMode = null;
      return;
    }

    if (mode === this.activeMode && this.activeLayer) {
      this.activeLayer?.setProfile(profile);
      return;
    }

    if (mode !== this.activeMode) {
      this.clearLayer();
    }
    this.activeMode = mode;
    const token = ++this.loadToken;
    void this.loadLayer(mode, token);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const atmosphereVisibility = runtime.orchestration.atmosphereVisibility;
    const effectiveRuntime = {
      ...runtime,
      rainIntensity: runtime.rainIntensity * atmosphereVisibility,
      snowIntensity: runtime.snowIntensity * atmosphereVisibility,
      fogDensity: runtime.fogDensity * atmosphereVisibility,
      particleIntensity: runtime.particleIntensity * atmosphereVisibility
    };

    this.activeLayer?.update(frame, effectiveRuntime);
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayer();
    this.profile = null;
    this.activeMode = null;
  }

  private async loadLayer(mode: AtmosphereMode, token: number) {
    const profile = this.profile;

    if (!this.isLayerRequestActive(mode, token, profile)) {
      return;
    }

    let layer: WeatherSystemLayer;

    try {
      if (mode === 'rain-haze') {
        const { RainHazeLayer } = await import('./atmosphere/RainHazeLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new RainHazeLayer(this.context!.scene, this.context!.camera, profile);
      } else if (mode === 'snow-veil') {
        const { SnowVeilLayer } = await import('./atmosphere/SnowVeilLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new SnowVeilLayer(this.context!.scene, this.context!.camera, profile);
      } else if (mode === 'fog') {
        const { FogAtmosphereLayer } = await import('./atmosphere/FogAtmosphereLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new FogAtmosphereLayer(this.context!.scene, this.context!.camera, this.context!.wind, profile);
      } else {
        const { DustAtmosphereLayer } = await import('./atmosphere/DustAtmosphereLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new DustAtmosphereLayer(this.context!.scene, this.context!.camera, this.context!.wind, profile);
      }
    } catch (error) {
      warnWeatherLayerLoadFailure('AtmosphereSystem', error);
      return;
    }

    if (!this.isLayerRequestActive(mode, token, profile)) {
      layer.dispose();
      return;
    }

    this.activeLayer = layer;
    this.activeLayer.setProfile(this.profile ?? profile);
  }

  private isLayerRequestActive(mode: AtmosphereMode, token: number, profile: WeatherProfile | null): profile is WeatherProfile {
    return Boolean(this.context && profile && !this.disposed && token === this.loadToken && mode === this.activeMode);
  }

  private clearLayer() {
    this.activeLayer?.dispose();
    this.activeLayer = null;
  }
}
