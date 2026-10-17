import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWeatherRenderer } from '../core/createWeatherRenderer';

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

type RendererParams = {
  canvas: HTMLCanvasElement;
  alpha?: boolean;
  antialias?: boolean;
  powerPreference?: string;
  premultipliedAlpha?: boolean;
};

class FakeRenderer {
  static instances: FakeRenderer[] = [];

  readonly params: RendererParams;
  readonly clearColorCalls: Array<[number, number]> = [];
  readonly pixelRatioCalls: number[] = [];
  readonly sizeCalls: Array<[number, number, boolean | undefined]> = [];
  readonly animationLoopCalls: Array<FrameRequestCallback | null> = [];
  readonly renderCalls: Array<[unknown, unknown]> = [];
  outputColorSpace: unknown;
  toneMapping: unknown;
  toneMappingExposure = 0;
  disposed = false;

  constructor(params: RendererParams) {
    this.params = params;
    FakeRenderer.instances.push(this);
  }

  setClearColor(color: number, alpha: number) {
    this.clearColorCalls.push([color, alpha]);
  }

  setPixelRatio(ratio: number) {
    this.pixelRatioCalls.push(ratio);
  }

  setSize(width: number, height: number, updateStyle?: boolean) {
    this.sizeCalls.push([width, height, updateStyle]);
  }

  setAnimationLoop(callback: FrameRequestCallback | null) {
    this.animationLoopCalls.push(callback);
  }

  render(scene: unknown, camera: unknown) {
    this.renderCalls.push([scene, camera]);
  }

  dispose() {
    this.disposed = true;
  }
}

class FakeWebGLRenderer extends FakeRenderer {}

class FakeWebGPURenderer extends FakeRenderer {
  init = vi.fn(async () => undefined);
}

function fakeThree() {
  return {
    WebGLRenderer: FakeWebGLRenderer,
    SRGBColorSpace: 'srgb',
    ACESFilmicToneMapping: 'aces'
  };
}

function capability(isAvailable: boolean) {
  return {
    default: {
      isAvailable: () => isAvailable
    }
  };
}

function canvas() {
  return document.createElement('canvas');
}

describe('weather renderer factory', () => {
  afterEach(() => {
    FakeRenderer.instances = [];
    vi.restoreAllMocks();
  });

  it('declares the WebGL and WebGPU renderer contract', () => {
    const typesSource = readSource('src/modules/weather/core/types.ts');

    expect(typesSource).toContain("export type WeatherRendererKind = 'webgl' | 'webgpu'");
    expect(typesSource).toContain('interface WeatherRenderer');
    expect(typesSource).toContain('gpuAvailable: boolean');
  });

  it('uses WebGPU when capability detection and renderer init succeed', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });

    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(true),
      loadWebGPUModule: async () => ({ WebGPURenderer: FakeWebGPURenderer })
    });

    expect(result.rendererKind).toBe('webgpu');
    expect(result.gpuAvailable).toBe(true);
    expect(result.renderer).toBeInstanceOf(FakeWebGPURenderer);
    expect((result.renderer as FakeWebGPURenderer).init).toHaveBeenCalledOnce();
    expect((result.renderer as FakeRenderer).clearColorCalls).toEqual([[0x000000, 0]]);
    expect((result.renderer as FakeRenderer).pixelRatioCalls).toEqual([2]);
    expect((result.renderer as FakeRenderer).outputColorSpace).toBe('srgb');
    expect((result.renderer as FakeRenderer).toneMapping).toBe('aces');
    expect((result.renderer as FakeRenderer).toneMappingExposure).toBe(1.05);
  });

  it('falls back to WebGL without importing WebGPU renderer when capability is false', async () => {
    const loadWebGPUModule = vi.fn();

    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(false),
      loadWebGPUModule
    });

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(false);
    expect(result.renderer).toBeInstanceOf(FakeWebGLRenderer);
    expect(loadWebGPUModule).not.toHaveBeenCalled();
  });

  it('falls back to WebGL when WebGPU capability import fails', async () => {
    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => {
        throw new Error('capability import failed');
      },
      loadWebGPUModule: async () => ({ WebGPURenderer: FakeWebGPURenderer })
    });

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(false);
    expect(result.renderer).toBeInstanceOf(FakeWebGLRenderer);
  });

  it('falls back to WebGL when WebGPU renderer import fails', async () => {
    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(true),
      loadWebGPUModule: async () => {
        throw new Error('webgpu import failed');
      }
    });

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(true);
    expect(result.renderer).toBeInstanceOf(FakeWebGLRenderer);
  });

  it('falls back to WebGL and disposes the failed WebGPU renderer when init fails', async () => {
    class InitFailureWebGPURenderer extends FakeRenderer {
      init = vi.fn(async () => {
        throw new Error('init failed');
      });
    }

    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(true),
      loadWebGPUModule: async () => ({ WebGPURenderer: InitFailureWebGPURenderer })
    });

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(true);
    expect(FakeRenderer.instances[0]).toBeInstanceOf(InitFailureWebGPURenderer);
    expect(FakeRenderer.instances[0].disposed).toBe(true);
    expect(result.renderer).toBeInstanceOf(FakeWebGLRenderer);
  });

  it('falls back to WebGL when WebGPU cannot render the current GLSL ShaderMaterial pipeline', async () => {
    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(true),
      loadWebGPUModule: async () => ({ WebGPURenderer: FakeWebGPURenderer }),
      validateWebGPURenderer: async () => false
    });

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(true);
    expect(FakeRenderer.instances[0]).toBeInstanceOf(FakeWebGPURenderer);
    expect(FakeRenderer.instances[0].disposed).toBe(true);
    expect(result.renderer).toBeInstanceOf(FakeWebGLRenderer);
  });

  it('falls back to WebGL when WebGPU construction fails and keeps WebGL renderer settings', async () => {
    class ConstructorFailureWebGPURenderer extends FakeRenderer {
      constructor(params: RendererParams) {
        super(params);
        throw new Error('constructor failed');
      }
    }

    const result = await createWeatherRenderer(canvas(), {
      three: fakeThree(),
      loadWebGPUCapability: async () => capability(true),
      loadWebGPUModule: async () => ({ WebGPURenderer: ConstructorFailureWebGPURenderer })
    });
    const webglRenderer = result.renderer as FakeRenderer;

    expect(result.rendererKind).toBe('webgl');
    expect(result.gpuAvailable).toBe(true);
    expect(webglRenderer).toBeInstanceOf(FakeWebGLRenderer);
    expect(webglRenderer.params).toMatchObject({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true
    });
    expect(webglRenderer.clearColorCalls).toEqual([[0x000000, 0]]);
    expect(webglRenderer.outputColorSpace).toBe('srgb');
    expect(webglRenderer.toneMapping).toBe('aces');
    expect(webglRenderer.toneMappingExposure).toBe(1.05);
  });

  it('keeps the supported three@0.184 WebGPU import paths and async layer integration', () => {
    const rendererSource = readSource('src/modules/weather/core/createWeatherRenderer.ts');
    const layerSource = readSource('src/modules/weather/components/ThreeWeatherLayer.vue');
    const viteSource = readSource('vite.config.ts');

    expect(rendererSource).toContain("import('three/addons/capabilities/WebGPU.js')");
    expect(rendererSource).toContain("import('three/webgpu')");
    expect(rendererSource).toContain('validateShaderMaterialRenderer');
    expect(rendererSource).not.toContain('three/addons/renderers/webgpu/WebGPURenderer.js');
    expect(layerSource).toContain('await createWeatherRenderer(canvas)');
    expect(layerSource).toContain('let renderer: WeatherRenderer | undefined');
    expect(layerSource).not.toContain('let renderer: import(\'three\').WebGLRenderer | undefined');
    expect(layerSource).toContain('initLayerToken');
    expect(viteSource).toContain("target: 'es2022'");
    expect(viteSource).toContain('optimizeDeps');
  });
});
