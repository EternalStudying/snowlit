import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { LazyLayers } from './LazyLayers';

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
  private readonly layers = new LazyLayers<AtmosphereMode, WeatherSystemLayer>(
    'AtmosphereSystem',
    (mode) => this.loadLayer(mode),
    (layer) => layer.setProfile(this.profile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolveAtmosphereMode(profile);
    this.layers.show(this.context && mode ? [mode] : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const atmosphereVisibility = runtime.orchestration.atmosphereVisibility;
    this.layers.update(frame, {
      ...runtime,
      rainIntensity: runtime.rainIntensity * atmosphereVisibility,
      snowIntensity: runtime.snowIntensity * atmosphereVisibility,
      fogDensity: runtime.fogDensity * atmosphereVisibility,
      particleIntensity: runtime.particleIntensity * atmosphereVisibility
    });
  }

  dispose() {
    this.layers.dispose();
    this.profile = null;
  }

  private async loadLayer(mode: AtmosphereMode): Promise<() => WeatherSystemLayer> {
    const { scene, camera, wind } = this.context!;
    if (mode === 'rain-haze') {
      const { RainHazeLayer } = await import('./atmosphere/RainHazeLayer');
      return () => new RainHazeLayer(scene, camera, this.profile!);
    }
    if (mode === 'snow-veil') {
      const { SnowVeilLayer } = await import('./atmosphere/SnowVeilLayer');
      return () => new SnowVeilLayer(scene, camera, this.profile!);
    }
    if (mode === 'fog') {
      const { FogAtmosphereLayer } = await import('./atmosphere/FogAtmosphereLayer');
      return () => new FogAtmosphereLayer(scene, camera, wind, this.profile!);
    }
    const { DustAtmosphereLayer } = await import('./atmosphere/DustAtmosphereLayer');
    return () => new DustAtmosphereLayer(scene, camera, wind, this.profile!);
  }
}
