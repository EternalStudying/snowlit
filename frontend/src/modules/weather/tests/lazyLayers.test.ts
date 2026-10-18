import { describe, expect, it, vi } from 'vitest';
import { LazyLayers, type LazyLayer } from '../systems/LazyLayers';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function layer(name: string): LazyLayer & { name: string } {
  return { name, update: vi.fn(), dispose: vi.fn() };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LazyLayers', () => {
  it('loads wanted keys once, refreshes kept layers and disposes unwanted ones', async () => {
    const apply = vi.fn();
    const load = vi.fn(async (key: string) => () => layer(key));
    const layers = new LazyLayers('test', load, apply);

    layers.show(['rain', 'splash']);
    await flush();
    expect(layers.keys()).toEqual(['rain', 'splash']);
    expect(apply).toHaveBeenCalledTimes(2);

    const splash = layers.get('splash')!;
    layers.show(['rain']);
    expect(splash.dispose).toHaveBeenCalled();
    expect(apply).toHaveBeenCalledTimes(3);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('discards a load that finishes after its key stopped being wanted', async () => {
    const pending = deferred<() => LazyLayer>();
    const create = vi.fn(() => layer('fog'));
    const layers = new LazyLayers('test', () => pending.promise, vi.fn());

    layers.show(['fog']);
    layers.show([]);
    pending.resolve(create);
    await flush();

    expect(create).not.toHaveBeenCalled();
    expect(layers.keys()).toEqual([]);
  });

  it('builds nothing after disposal and survives a failed import', async () => {
    const failing = new LazyLayers('test', async () => {
      throw new Error('chunk missing');
    }, vi.fn());
    failing.show(['snow']);
    await flush();
    expect(failing.keys()).toEqual([]);

    const pending = deferred<() => LazyLayer>();
    const create = vi.fn(() => layer('aurora'));
    const disposed = new LazyLayers('test', () => pending.promise, vi.fn());
    disposed.show(['aurora']);
    disposed.dispose();
    pending.resolve(create);
    await flush();
    expect(create).not.toHaveBeenCalled();
  });
});
