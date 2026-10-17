import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext
} from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';
import { getSkyProfile, type SkyProfile } from '../profiles/skyProfiles';
import { getCloudLightingProfile, type CloudLightingProfile } from './clouds/cloudLightingProfile';

type CloudSkyLayer = {
  setSkyProfile(skyProfile: SkyProfile, lightingProfile: CloudLightingProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

export class CloudSkySystem implements WeatherSystem {
  private profile: WeatherProfile | null = null;
  private skyProfile: SkyProfile | null = null;
  private lightingProfile: CloudLightingProfile | null = null;
  private activeLayer: CloudSkyLayer | null = null;
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
    const lightingProfile = getCloudLightingProfile(profile, skyProfile);
    this.skyProfile = skyProfile;
    this.lightingProfile = lightingProfile;
    const nextKey = this.createLayerKey(skyProfile);

    if (!this.context || profile.weatherState !== 'cloudy' || !skyProfile.cloud.enabled || skyProfile.cloud.opacity <= 0.05) {
      this.clearLayer();
      this.activeKey = null;
      return;
    }

    if (this.activeLayer && nextKey === this.activeKey) {
      this.activeLayer.setSkyProfile(skyProfile, lightingProfile);
      return;
    }

    this.clearLayer();
    this.activeKey = nextKey;
    const token = ++this.loadToken;
    void this.loadLayer(token);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.activeLayer?.update(frame, runtime);
  }

  dispose() {
    this.disposed = true;
    this.loadToken += 1;
    this.clearLayer();
    this.profile = null;
    this.skyProfile = null;
    this.lightingProfile = null;
    this.activeKey = null;
  }

  private async loadLayer(token: number) {
    const skyProfile = this.skyProfile;
    const lightingProfile = this.lightingProfile;

    if (!skyProfile || !lightingProfile || !this.isLayerRequestActive(token, skyProfile, lightingProfile)) {
      return;
    }

    let layer: CloudSkyLayer;

    try {
      const { CloudSkyLayer } = await import('./clouds/CloudSkyLayer');

      if (!this.isLayerRequestActive(token, skyProfile, lightingProfile)) {
        return;
      }

      layer = new CloudSkyLayer(this.context!.scene, this.context!.camera, skyProfile, lightingProfile);
    } catch (error) {
      warnWeatherLayerLoadFailure('CloudSkySystem', error);
      return;
    }

    if (!this.isLayerRequestActive(token, skyProfile, lightingProfile)) {
      layer.dispose();
      return;
    }

    this.activeLayer = layer;
    this.activeLayer.setSkyProfile(this.skyProfile ?? skyProfile, this.lightingProfile ?? lightingProfile);
  }

  private isLayerRequestActive(token: number, skyProfile: SkyProfile, lightingProfile: CloudLightingProfile) {
    return Boolean(
      this.context &&
        skyProfile &&
        lightingProfile &&
        !this.disposed &&
        token === this.loadToken &&
        this.createLayerKey(skyProfile) === this.activeKey
    );
  }

  private createLayerKey(skyProfile: SkyProfile) {
    return [
      skyProfile.cloud.enabled,
      skyProfile.cloud.primary,
      skyProfile.cloud.secondary ?? 'none',
      skyProfile.cloud.mood
    ].join(':');
  }

  private clearLayer() {
    this.loadToken += 1;
    this.activeLayer?.dispose();
    this.activeLayer = null;
  }
}
