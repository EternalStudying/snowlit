import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherSystemLayer
} from '../core/types';
import { LazyLayers } from './LazyLayers';

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
  private readonly layers = new LazyLayers<ElectricalMode, WeatherSystemLayer>(
    'ElectricalSystem',
    (mode) => this.loadLayer(mode),
    (layer) => layer.setProfile(this.profile!)
  );

  constructor(private readonly context?: WeatherSystemContext) {}

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const mode = resolveElectricalMode(profile);
    this.layers.show(this.context && mode ? [mode] : []);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const electricalVisibility = runtime.orchestration.electricalVisibility;
    this.layers.update(frame, {
      ...runtime,
      lightningIntensity: runtime.lightningIntensity * electricalVisibility,
      particleIntensity: runtime.particleIntensity * electricalVisibility
    });
  }

  dispose() {
    this.layers.dispose();
    this.profile = null;
  }

  private async loadLayer(mode: ElectricalMode): Promise<() => WeatherSystemLayer> {
    const { scene, camera, visualSignals } = this.context!;
    if (mode === 'storm-lightning') {
      const { LightningLayer } = await import('./electrical/LightningLayer');
      return () => new LightningLayer(scene, camera, this.profile!, visualSignals);
    }
    const { DustLightningLayer } = await import('./electrical/DustLightningLayer');
    return () => new DustLightningLayer(scene, camera, this.profile!, visualSignals);
  }
}
