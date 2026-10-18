import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { LazyLayers } from './LazyLayers';

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
  private readonly layers = new LazyLayers<OpticalLayerKey, WeatherSystemLayer>(
    'OpticalSystem',
    (key) => this.loadLayer(key),
    (layer) => layer.setProfile(this.profile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    if (!this.context) {
      this.layers.show([]);
      return;
    }

    const keys = resolveOpticalLayerKeys(profile);
    // With nothing new to show, keep the current layers so they can fade out in update().
    this.layers.show(keys.length > 0 ? keys : this.layers.keys());
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.layers.update(frame, runtime);

    const faded =
      runtime.orchestration.sunnyOpticalVisibility <= 0.01 && runtime.orchestration.auroraVisibility <= 0.01;
    if (runtime.transitionProgress >= 1 && faded && this.profile) {
      this.layers.show(resolveOpticalLayerKeys(this.profile));
    }
  }

  dispose() {
    this.layers.dispose();
    this.profile = null;
  }

  private async loadLayer(key: OpticalLayerKey): Promise<() => WeatherSystemLayer> {
    const { scene, camera, wind } = this.context!;
    if (key === 'sunny') {
      const { SunnyOpticalLayer } = await import('./optical/SunnyOpticalLayer');
      return () => new SunnyOpticalLayer(scene, camera, wind, this.profile!);
    }
    if (key === 'rainbow') {
      const { RainbowOpticalLayer } = await import('./optical/RainbowOpticalLayer');
      return () => new RainbowOpticalLayer(scene, camera, this.profile!);
    }
    if (key === 'wet-lens') {
      const { WetLensOverlayLayer } = await import('./optical/WetLensOverlayLayer');
      return () => new WetLensOverlayLayer(scene, camera, this.profile!);
    }
    if (key === 'frost') {
      const { FrostOverlayLayer } = await import('./optical/FrostOverlayLayer');
      return () => new FrostOverlayLayer(scene, camera, this.profile!);
    }
    const { AuroraOpticalLayer } = await import('./optical/AuroraOpticalLayer');
    return () => new AuroraOpticalLayer(scene, camera, this.profile!);
  }
}
