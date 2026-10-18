import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { LazyLayers } from './LazyLayers';

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
  private readonly layers = new LazyLayers<PrecipitationLayerKey, WeatherSystemLayer>(
    'PrecipitationSystem',
    (key) => this.loadLayer(key),
    (layer) => layer.setProfile(this.profile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolvePrecipitationMode(profile);
    this.layers.show(this.context && mode ? layerKeysFor(mode) : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const precipitationVisibility = runtime.orchestration.precipitationVisibility;
    this.layers.update(frame, {
      ...runtime,
      rainIntensity: runtime.rainIntensity * precipitationVisibility,
      snowIntensity: runtime.snowIntensity * precipitationVisibility,
      particleIntensity: runtime.particleIntensity * precipitationVisibility
    });
  }

  dispose() {
    this.layers.dispose();
    this.profile = null;
  }

  private async loadLayer(key: PrecipitationLayerKey): Promise<() => WeatherSystemLayer> {
    const { scene, camera, wind } = this.context!;
    if (key === 'rain') {
      const { RainPrecipitationLayer } = await import('./precipitation/RainPrecipitationLayer');
      return () => new RainPrecipitationLayer(scene, camera, wind, this.profile!);
    }
    if (key === 'rain-splash') {
      const { RainSplashLayer } = await import('./precipitation/RainSplashLayer');
      return () => new RainSplashLayer(scene, camera, this.profile!);
    }
    if (key === 'hail') {
      const { HailPrecipitationLayer } = await import('./precipitation/HailPrecipitationLayer');
      return () => new HailPrecipitationLayer(scene, camera, wind, this.profile!);
    }
    const { SnowPrecipitationLayer } = await import('./precipitation/SnowPrecipitationLayer');
    return () => new SnowPrecipitationLayer(scene, camera, wind, this.profile!);
  }
}

function layerKeysFor(mode: PrecipitationMode | 'hail'): PrecipitationLayerKey[] {
  if (mode === 'hail') {
    return ['hail'];
  }
  return mode === 'rain' ? ['rain', 'rain-splash'] : ['snow'];
}
