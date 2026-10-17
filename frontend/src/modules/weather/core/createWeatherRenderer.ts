import * as THREE from 'three';
import type { WeatherRenderer, WeatherRendererResult } from './types';
import { WEATHER_PIXEL_RATIO_CAP } from './weatherPerformanceBudget';

type RendererCreationParameters = {
  canvas: HTMLCanvasElement;
  alpha: boolean;
  antialias: boolean;
  powerPreference?: 'high-performance';
  premultipliedAlpha: boolean;
};

type InitializableWeatherRenderer = WeatherRenderer & {
  init?: () => Promise<unknown>;
};

type ThreeRendererModule = {
  WebGLRenderer: new (parameters: RendererCreationParameters) => WeatherRenderer;
  SRGBColorSpace: unknown;
  ACESFilmicToneMapping: unknown;
  Scene?: typeof THREE.Scene;
  PerspectiveCamera?: typeof THREE.PerspectiveCamera;
  PlaneGeometry?: typeof THREE.PlaneGeometry;
  ShaderMaterial?: typeof THREE.ShaderMaterial;
  Mesh?: typeof THREE.Mesh;
};

type WebGPUCapabilityModule = {
  default?: {
    isAvailable(): boolean;
  };
  isAvailable?: () => boolean;
};

type WebGPURendererConstructor = new (parameters: RendererCreationParameters) => InitializableWeatherRenderer;

type WebGPUModule = {
  default?: WebGPURendererConstructor;
  WebGPURenderer?: WebGPURendererConstructor;
};

type ShaderValidationThreeModule = ThreeRendererModule & {
  Scene: typeof THREE.Scene;
  PerspectiveCamera: typeof THREE.PerspectiveCamera;
  PlaneGeometry: typeof THREE.PlaneGeometry;
  ShaderMaterial: typeof THREE.ShaderMaterial;
  Mesh: typeof THREE.Mesh;
};

export interface CreateWeatherRendererOptions {
  preferWebGPU?: boolean;
  forceWebGL?: boolean;
  three?: ThreeRendererModule;
  loadWebGPUCapability?: () => Promise<WebGPUCapabilityModule>;
  loadWebGPUModule?: () => Promise<WebGPUModule>;
  validateWebGPURenderer?: (renderer: InitializableWeatherRenderer, three: ThreeRendererModule) => boolean | Promise<boolean>;
}

const DEFAULT_OPTIONS = {
  preferWebGPU: true,
  forceWebGL: false
} satisfies Pick<CreateWeatherRendererOptions, 'preferWebGPU' | 'forceWebGL'>;

async function defaultLoadWebGPUCapability() {
  return import('three/addons/capabilities/WebGPU.js');
}

async function defaultLoadWebGPUModule() {
  return (await import('three/webgpu')) as unknown as WebGPUModule;
}

function configureRenderer(renderer: WeatherRenderer, three: ThreeRendererModule) {
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, WEATHER_PIXEL_RATIO_CAP));
  renderer.outputColorSpace = three.SRGBColorSpace;
  renderer.toneMapping = three.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

function createWebGLRenderer(canvas: HTMLCanvasElement, three: ThreeRendererModule): WeatherRenderer {
  const renderer = new three.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    premultipliedAlpha: true
  }) as WeatherRenderer;

  configureRenderer(renderer, three);

  return renderer;
}

function canValidateShaderMaterial(three: ThreeRendererModule): three is ShaderValidationThreeModule {
  return Boolean(three.Scene && three.PerspectiveCamera && three.PlaneGeometry && three.ShaderMaterial && three.Mesh);
}

async function validateShaderMaterialRenderer(renderer: InitializableWeatherRenderer, three: ThreeRendererModule) {
  if (!canValidateShaderMaterial(three)) {
    return true;
  }

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(45, 1, 0.1, 10);
  const geometry = new three.PlaneGeometry(0.1, 0.1);
  const material = new three.ShaderMaterial({
    vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}'
  });
  const mesh = new three.Mesh(geometry, material);
  let shaderMaterialIncompatible = false;
  const originalConsoleError = console.error;

  scene.add(mesh);
  camera.position.z = 1;
  console.error = (...args: unknown[]) => {
    const message = String(args[0] ?? '');

    if (message.includes('THREE.NodeBuilder') && message.includes('ShaderMaterial')) {
      shaderMaterialIncompatible = true;
      return;
    }

    originalConsoleError(...args);
  };

  try {
    renderer.render(scene, camera);
  } catch {
    shaderMaterialIncompatible = true;
  } finally {
    console.error = originalConsoleError;
    geometry.dispose();
    material.dispose();
  }

  return !shaderMaterialIncompatible;
}

async function tryCreateWebGPURenderer(
  canvas: HTMLCanvasElement,
  three: ThreeRendererModule,
  options: Required<
    Pick<CreateWeatherRendererOptions, 'loadWebGPUCapability' | 'loadWebGPUModule' | 'validateWebGPURenderer'>
  >
) {
  let gpuAvailable = false;
  let webgpuRenderer: InitializableWeatherRenderer | undefined;

  try {
    const capabilityModule = await options.loadWebGPUCapability();
    const capability = capabilityModule.default ?? capabilityModule;
    gpuAvailable = Boolean(capability.isAvailable?.());

    if (!gpuAvailable) {
      return { gpuAvailable, renderer: undefined };
    }

    const webgpuModule = await options.loadWebGPUModule();
    const WebGPURenderer = webgpuModule.WebGPURenderer ?? webgpuModule.default;

    if (!WebGPURenderer) {
      return { gpuAvailable, renderer: undefined };
    }

    if (options.validateWebGPURenderer === validateShaderMaterialRenderer && canValidateShaderMaterial(three)) {
      const probeRenderer = new WebGPURenderer({
        canvas: document.createElement('canvas'),
        alpha: true,
        antialias: true,
        premultipliedAlpha: true
      });

      try {
        await probeRenderer.init?.();

        if (!(await options.validateWebGPURenderer(probeRenderer, three))) {
          return { gpuAvailable, renderer: undefined };
        }
      } finally {
        probeRenderer.dispose();
      }
    }

    webgpuRenderer = new WebGPURenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true
    });
    await webgpuRenderer.init?.();

    if (
      options.validateWebGPURenderer !== validateShaderMaterialRenderer &&
      !(await options.validateWebGPURenderer(webgpuRenderer, three))
    ) {
      webgpuRenderer.dispose();

      return { gpuAvailable, renderer: undefined };
    }

    configureRenderer(webgpuRenderer, three);

    return { gpuAvailable, renderer: webgpuRenderer };
  } catch {
    webgpuRenderer?.dispose();

    return { gpuAvailable, renderer: undefined };
  }
}

export async function createWeatherRenderer(
  canvas: HTMLCanvasElement,
  options: CreateWeatherRendererOptions = {}
): Promise<WeatherRendererResult> {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };
  const three = resolvedOptions.three ?? THREE;
  const loaders = {
    loadWebGPUCapability: resolvedOptions.loadWebGPUCapability ?? defaultLoadWebGPUCapability,
    loadWebGPUModule: resolvedOptions.loadWebGPUModule ?? defaultLoadWebGPUModule,
    validateWebGPURenderer: resolvedOptions.validateWebGPURenderer ?? validateShaderMaterialRenderer
  };

  if (resolvedOptions.preferWebGPU && !resolvedOptions.forceWebGL) {
    const webgpuResult = await tryCreateWebGPURenderer(canvas, three, loaders);

    if (webgpuResult.renderer) {
      return {
        rendererKind: 'webgpu',
        gpuAvailable: webgpuResult.gpuAvailable,
        renderer: webgpuResult.renderer
      };
    }

    const renderer = createWebGLRenderer(canvas, three);

    return {
      rendererKind: 'webgl',
      gpuAvailable: webgpuResult.gpuAvailable,
      renderer
    };
  }

  return {
    rendererKind: 'webgl',
    gpuAvailable: false,
    renderer: createWebGLRenderer(canvas, three)
  };
}
