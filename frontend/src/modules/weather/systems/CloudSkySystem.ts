import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext
} from '../core/types';
import { LazyLayers } from './LazyLayers';
import { getSkyProfile, type SkyProfile } from '../profiles/skyProfiles';
import { getCloudLightingProfile, type CloudLightingProfile } from './clouds/cloudLightingProfile';

type CloudSkyLayer = {
  setSkyProfile(skyProfile: SkyProfile, lightingProfile: CloudLightingProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

export class CloudSkySystem implements WeatherSystem {
  private skyProfile: SkyProfile | null = null;
  private lightingProfile: CloudLightingProfile | null = null;
  private readonly layers = new LazyLayers<string, CloudSkyLayer>(
    'CloudSkySystem',
    () => this.loadLayer(),
    (layer) => layer.setSkyProfile(this.skyProfile!, this.lightingProfile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    const skyProfile = getSkyProfile({
      weatherState: profile.weatherState,
      weatherVariant: profile.weatherVariant,
      precipitationKind: profile.precipitationKind,
      daylightHint: profile.daylightHint ?? 'unknown'
    });
    this.skyProfile = skyProfile;
    this.lightingProfile = getCloudLightingProfile(profile, skyProfile);
    const visible =
      this.context && profile.weatherState === 'cloudy' && skyProfile.cloud.enabled && skyProfile.cloud.opacity > 0.05;
    // A different cloud mix needs a freshly built layer, so the mix is the layer key.
    this.layers.show(visible ? [cloudMixKey(skyProfile)] : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.layers.update(frame, runtime);
  }

  dispose() {
    this.layers.dispose();
    this.skyProfile = null;
    this.lightingProfile = null;
  }

  private async loadLayer(): Promise<() => CloudSkyLayer> {
    const { CloudSkyLayer } = await import('./clouds/CloudSkyLayer');
    const { scene, camera } = this.context!;
    return () => new CloudSkyLayer(scene, camera, this.skyProfile!, this.lightingProfile!);
  }
}

function cloudMixKey(skyProfile: SkyProfile) {
  return [
    skyProfile.cloud.enabled,
    skyProfile.cloud.primary,
    skyProfile.cloud.secondary ?? 'none',
    skyProfile.cloud.mood
  ].join(':');
}
