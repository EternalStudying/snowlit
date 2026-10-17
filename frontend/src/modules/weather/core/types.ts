import type { DaylightHint, PrecipitationKind, WeatherState, WeatherVariant } from '../model';
import type { WeatherOrchestrationProfile } from './weatherOrchestrationProfile';
import type { WindSystem } from './WindSystem';

export type WeatherRenderMode =
  | 'none'
  | 'three-clear'
  | 'three-cloudy'
  | 'three-rain'
  | 'three-storm'
  | 'three-snow'
  | 'three-fog'
  | 'three-sandstorm'
  | 'three-aurora'
  | 'legacy';

export type LegacyWeatherKind = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder' | 'windy' | 'night';

export type WeatherRendererKind = 'webgl' | 'webgpu';

export interface WeatherRenderer {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
  setClearColor(color: number, alpha?: number): void;
  setAnimationLoop(callback: FrameRequestCallback | null): void;
  render(scene: import('three').Scene, camera: import('three').Camera): void;
  dispose(): void;
  outputColorSpace: unknown;
  toneMapping: unknown;
  toneMappingExposure: number;
}

export interface WeatherProfile {
  weatherState: WeatherState;
  weatherVariant: WeatherVariant;
  precipitationKind?: PrecipitationKind;
  daylightHint?: DaylightHint;
  meteorShower?: boolean;
  legacyKind: LegacyWeatherKind;
  label: string;
  renderer: WeatherRenderMode;
  ambientWarmth: number;
  particleIntensity: number;
  windMultiplier: number;
}

export interface WeatherStateParameters {
  rain: number;
  snow: number;
  fogDensity: number;
  lightning: number;
  skyDarkness: number;
  windMultiplier: number;
}

export interface WeatherRuntimeState {
  currentProfile: WeatherProfile;
  targetProfile: WeatherProfile;
  transitionProgress: number;
  orchestration: WeatherOrchestrationProfile;
  rainIntensity: number;
  snowIntensity: number;
  fogDensity: number;
  lightningIntensity: number;
  skyDarkness: number;
  windMultiplier: number;
  ambientWarmth: number;
  particleIntensity: number;
}

export interface WeatherRenderModeInput {
  weatherState: WeatherState;
  isLargeViewport: boolean;
  prefersReducedMotion: boolean;
}

export interface WeatherPointerState {
  x: number;
  y: number;
}

export interface WeatherFrameState {
  elapsed: number;
  delta: number;
  pointer: WeatherPointerState;
  scrollY: number;
}

export interface WeatherVisualSignals {
  stormFlash: number;
  dustFlash: number;
}

export interface WeatherSystemContext {
  scene: import('three').Scene;
  camera: import('three').PerspectiveCamera;
  wind: WindSystem;
  visualSignals?: WeatherVisualSignals;
}

export interface WeatherSystem {
  setProfile(profile: WeatherProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
}

export interface WeatherSystemLayer extends WeatherSystem {}

export interface WeatherRendererResult {
  rendererKind: WeatherRendererKind;
  gpuAvailable: boolean;
  renderer: WeatherRenderer;
}
