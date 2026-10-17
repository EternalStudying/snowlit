import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

type ElectricalMode = 'storm-lightning' | 'dust-lightning';

function resolveElectricalMode(profile: WeatherProfile): ElectricalMode | null {
  if (profile.weatherState === 'storm') {
    return 'storm-lightning';
  }

  if (profile.weatherState === 'sandstorm') {
    return 'dust-lightning';
  }

  return null;
}

export class ElectricalSystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private activeMode: ElectricalMode | null = null;
  private activeLayer: WeatherSystemLayer | null = null;
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolveElectricalMode(profile);

    if (!this.context || !mode) {
      this.clearLayer();
      this.activeMode = null;
      return;
    }

    if (this.activeLayer && mode === this.activeMode) {
      this.activeLayer.setProfile(profile);
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
    const electricalVisibility = runtime.orchestration.electricalVisibility;
    const effectiveRuntime = {
      ...runtime,
      lightningIntensity: runtime.lightningIntensity * electricalVisibility,
      particleIntensity: runtime.particleIntensity * electricalVisibility
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

  private async loadLayer(mode: ElectricalMode, token: number) {
    const profile = this.profile;

    if (!this.isLayerRequestActive(mode, token, profile)) {
      return;
    }

    let layer: WeatherSystemLayer;

    try {
      if (mode === 'storm-lightning') {
        const { LightningLayer } = await import('./electrical/LightningLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new LightningLayer(this.context!.scene, this.context!.camera, profile, this.context!.visualSignals);
      } else {
        const { DustLightningLayer } = await import('./electrical/DustLightningLayer');

        if (!this.isLayerRequestActive(mode, token, profile)) {
          return;
        }

        layer = new DustLightningLayer(this.context!.scene, this.context!.camera, profile, this.context!.visualSignals);
      }
    } catch (error) {
      warnWeatherLayerLoadFailure('ElectricalSystem', error);
      return;
    }

    if (!this.isLayerRequestActive(mode, token, profile)) {
      layer.dispose();
      return;
    }

    this.activeLayer = layer;
    this.activeLayer.setProfile(this.profile ?? profile);
  }

  private isLayerRequestActive(mode: ElectricalMode, token: number, profile: WeatherProfile | null): profile is WeatherProfile {
    return Boolean(this.context && profile && !this.disposed && token === this.loadToken && mode === this.activeMode);
  }

  private clearLayer() {
    this.activeLayer?.dispose();
    this.activeLayer = null;
  }
}
