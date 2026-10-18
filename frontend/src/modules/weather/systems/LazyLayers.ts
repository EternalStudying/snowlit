import type { WeatherFrameState, WeatherRuntimeState } from '../core/types';
import { warnWeatherLayerLoadFailure } from '../core/weatherLayerLoading';

export interface LazyLayer {
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
}

/**
 * The layers a weather system currently shows, loaded on demand. `show` names the wanted keys: layers
 * no longer wanted are disposed, kept layers are refreshed through `apply`, and missing ones are imported
 * lazily. A load that finishes after its key stopped being wanted, or after disposal, is discarded.
 */
export class LazyLayers<K extends string, L extends LazyLayer> {
  private readonly active = new Map<K, L>();
  private readonly pending = new Set<K>();
  private wanted = new Set<K>();
  private disposed = false;

  constructor(
    private readonly owner: string,
    private readonly load: (key: K) => Promise<() => L>,
    private readonly apply: (layer: L, key: K) => void
  ) {}

  show(keys: Iterable<K>) {
    this.wanted = new Set(keys);
    this.active.forEach((layer, key) => {
      if (!this.wanted.has(key)) {
        layer.dispose();
        this.active.delete(key);
      }
    });
    this.wanted.forEach((key) => {
      const layer = this.active.get(key);
      if (layer) {
        this.apply(layer, key);
      } else if (!this.pending.has(key)) {
        void this.start(key);
      }
    });
  }

  /** Keys of layers that are loaded right now. */
  keys(): K[] {
    return [...this.active.keys()];
  }

  get(key: K): L | undefined {
    return this.active.get(key);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.active.forEach((layer) => layer.update(frame, runtime));
  }

  dispose() {
    this.disposed = true;
    this.wanted.clear();
    this.active.forEach((layer) => layer.dispose());
    this.active.clear();
  }

  private async start(key: K) {
    this.pending.add(key);
    try {
      const create = await this.load(key);
      if (this.disposed || !this.wanted.has(key) || this.active.has(key)) {
        return;
      }
      const layer = create();
      this.active.set(key, layer);
      this.apply(layer, key);
    } catch (error) {
      warnWeatherLayerLoadFailure(this.owner, error);
    } finally {
      this.pending.delete(key);
    }
  }
}
