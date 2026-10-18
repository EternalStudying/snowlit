import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystem, WeatherSystemContext } from '../core/types';
import { LazyLayers } from './LazyLayers';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getNightSkyRenderProfile, type NightSkyRenderProfile } from './nightSky/nightSkyProfile';

type NightSkyLayer = {
  setRenderProfile(profile: NightSkyRenderProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

export class NightSkySystem implements WeatherSystem {
  private renderProfile: NightSkyRenderProfile | null = null;
  private readonly layers = new LazyLayers<'night-sky', NightSkyLayer>(
    'NightSkySystem',
    () => this.loadLayer(),
    (layer) => {
      // A fading layer keeps its last enabled profile rather than switching to the disabled one.
      if (this.renderProfile!.enabled) {
        layer.setRenderProfile(this.renderProfile!);
      }
    }
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    const skyProfile = getSkyProfile({
      weatherState: profile.weatherState,
      weatherVariant: profile.weatherVariant,
      precipitationKind: profile.precipitationKind,
      daylightHint: profile.daylightHint ?? 'unknown'
    });
    this.renderProfile = getNightSkyRenderProfile(profile, skyProfile);

    if (!this.context) {
      this.layers.show([]);
      return;
    }
    // One night sky layer adapts to every render profile; when the sky is disabled an existing layer
    // stays until it has faded out in update().
    const keep = this.renderProfile.enabled || this.layers.keys().length > 0;
    this.layers.show(keep ? ['night-sky'] : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.layers.update(frame, runtime);

    if (
      this.renderProfile &&
      !this.renderProfile.enabled &&
      runtime.transitionProgress >= 1 &&
      runtime.orchestration.nightSkyVisibility <= 0.01
    ) {
      this.layers.show([]);
    }
  }

  dispose() {
    this.layers.dispose();
    this.renderProfile = null;
  }

  private async loadLayer(): Promise<() => NightSkyLayer> {
    const { NightSkyLayer } = await import('./nightSky/NightSkyLayer');
    const { scene, camera } = this.context!;
    return () => new NightSkyLayer(scene, camera, this.renderProfile!);
  }
}
