import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystem, WeatherSystemContext } from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getNightSkyRenderProfile, type NightSkyRenderProfile } from './nightSky/nightSkyProfile';

type NightSkyLayer = {
  setRenderProfile(profile: NightSkyRenderProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

export class NightSkySystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private renderProfile: NightSkyRenderProfile | null = null;
  private activeLayer: NightSkyLayer | null = null;
  private activeKey: string | null = null;
  private loadToken = 0;
  private disposed = false;

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const skyProfile = getSkyProfile({
      weatherState: profile.weatherState,
      weatherVariant: profile.weatherVariant,
      precipitationKind: profile.precipitationKind,
      daylightHint: profile.daylightHint ?? 'unknown'
    });
    const renderProfile = getNightSkyRenderProfile(profile, skyProfile);
    this.renderProfile = renderProfile;
    const nextKey = this.createLayerKey(renderProfile);

    if (!this.context) {
      this.clearLayer();
      this.activeKey = null;
      return;
    }

    if (!renderProfile.enabled) {
      if (!this.activeLayer) {
        this.clearLayer();
        this.activeKey = null;
      }
      return;
    }

    if (this.activeLayer && nextKey === this.activeKey) {
      this.activeLayer.setRenderProfile(renderProfile);
      return;
    }

    if (this.activeLayer) {
      this.activeKey = nextKey;
      this.activeLayer.setRenderProfile(renderProfile);
      return;
    }

    this.clearLayer();
    this.activeKey = nextKey;
    const token = ++this.loadToken;
    void this.loadLayer(token);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.activeLayer?.update(frame, runtime);

    if (
      this.activeLayer &&
      this.renderProfile &&
      !this.renderProfile.enabled &&
      runtime.transitionProgress >= 1 &&
      runtime.orchestration.nightSkyVisibility <= 0.01
    ) {
      this.clearLayer();
      this.activeKey = null;
    }
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayer();
    this.profile = null;
    this.renderProfile = null;
    this.activeKey = null;
  }

  private async loadLayer(token: number) {
    const renderProfile = this.renderProfile;

    if (!renderProfile || !this.isLayerRequestActive(token, renderProfile)) {
      return;
    }

    let layer: NightSkyLayer;

    try {
      const { NightSkyLayer } = await import('./nightSky/NightSkyLayer');

      if (!this.isLayerRequestActive(token, renderProfile)) {
        return;
      }

      layer = new NightSkyLayer(this.context!.scene, this.context!.camera, renderProfile);
    } catch (error) {
      warnWeatherLayerLoadFailure('NightSkySystem', error);
      return;
    }

    if (!this.isLayerRequestActive(token, renderProfile)) {
      layer.dispose();
      return;
    }

    this.activeLayer = layer;
    this.activeLayer.setRenderProfile(this.renderProfile ?? renderProfile);
  }

  private isLayerRequestActive(token: number, renderProfile: NightSkyRenderProfile) {
    return Boolean(
      this.context &&
        renderProfile.enabled &&
        !this.disposed &&
        token === this.loadToken &&
        this.createLayerKey(renderProfile) === this.activeKey
    );
  }

  private createLayerKey(renderProfile: NightSkyRenderProfile) {
    return [
      renderProfile.enabled,
      renderProfile.mode,
      renderProfile.starCount,
      renderProfile.milkyWayOpacity > 0.02,
      renderProfile.moonOpacity > 0.03,
      renderProfile.meteorRate > 0,
      renderProfile.meteorMaxActive,
      renderProfile.meteorShower
    ].join(':');
  }

  private clearLayer() {
    this.loadToken += 1;
    this.activeLayer?.dispose();
    this.activeLayer = null;
  }
}
