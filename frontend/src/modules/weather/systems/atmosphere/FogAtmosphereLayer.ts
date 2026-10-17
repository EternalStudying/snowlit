import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import type { WindSystem } from '../../core/WindSystem';
import fogElementUrl from '../../effects/fog/assets/fog-element.webp';
import denseFogElementUrl from '../../effects/fog/assets/dense-fog-element.webp';
import { FogSpriteLayer, type FogSpriteSettings } from './FogSpriteLayer';

type FogSpriteProfileSettings = FogSpriteSettings & {
  densityScale: number;
  opacityScale: number;
};

export const MIST_SPRITE_SETTINGS: FogSpriteProfileSettings = {
  count: 18,
  fogElementRatio: 0.8,
  alphaMin: 0.28,
  alphaMax: 0.46,
  scaleMin: 1,
  scaleMax: 2.25,
  moveSpeed: 0.02,
  centerProtection: 0.56,
  readabilityRadius: 0.42,
  color: 0xc0c9cc,
  densityScale: 32,
  opacityScale: 1.22
};

export const HAZE_SPRITE_SETTINGS: FogSpriteProfileSettings = {
  count: 38,
  fogElementRatio: 0.35,
  alphaMin: 0.2,
  alphaMax: 0.36,
  scaleMin: 1.25,
  scaleMax: 2.8,
  moveSpeed: 0.04,
  centerProtection: 0.62,
  readabilityRadius: 0.46,
  color: 0xb3baba,
  densityScale: 34,
  opacityScale: 1.3
};

const FOG_LAYER_Z = -5.4;
const DENSE_LAYER_Z = -5.8;

export class FogAtmosphereLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly windDir = new THREE.Vector2(0.62, 0.18);
  private readonly windOffset = new THREE.Vector2();
  private layers: FogSpriteLayer[] = [];
  private settings: FogSpriteProfileSettings;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.settings = this.resolveSettings();
    this.group.name = 'fog-atmosphere-system';
    this.scene.add(this.group);
    this.createSpriteLayers();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const nextSettings = this.resolveSettings();
    const shouldRebuild =
      nextSettings.count !== this.settings.count || nextSettings.fogElementRatio !== this.settings.fogElementRatio;

    this.settings = nextSettings;

    if (shouldRebuild) {
      this.createSpriteLayers();
      return;
    }

    const { fogCount, denseCount } = this.resolveTextureCounts();
    this.layers[0]?.setSettings(this.settings, fogCount);
    this.layers[1]?.setSettings(this.settings, denseCount);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const windForce = this.wind.force;
    this.windDir.set(windForce.x, windForce.z);

    if (this.windDir.lengthSq() < 0.0001) {
      this.windDir.set(0.62, 0.18);
    }

    this.windDir.normalize();
    this.windOffset.x = wrapOffset(this.windOffset.x + this.windDir.x * frame.delta * this.settings.moveSpeed * (0.8 + this.wind.speed));
    this.windOffset.y = wrapOffset(
      this.windOffset.y + this.windDir.y * frame.delta * this.settings.moveSpeed * (0.42 + this.wind.speed * 0.5)
    );

    const globalOpacity =
      Math.min(1, runtime.fogDensity * this.settings.densityScale) *
      this.settings.opacityScale *
      (0.58 + runtime.particleIntensity * 0.42);

    this.layers.forEach((layer) => {
      layer.update(frame, this.windOffset, globalOpacity);
    });
  }

  dispose() {
    this.clearSpriteLayers();
    this.group.removeFromParent();
  }

  private resolveSettings() {
    return this.profile.weatherVariant === 'haze' ? HAZE_SPRITE_SETTINGS : MIST_SPRITE_SETTINGS;
  }

  private resolveTextureCounts() {
    const fogCount = Math.round(this.settings.count * this.settings.fogElementRatio);

    return {
      fogCount,
      denseCount: this.settings.count - fogCount
    };
  }

  private createSpriteLayers() {
    this.clearSpriteLayers();

    const { fogCount, denseCount } = this.resolveTextureCounts();
    this.layers = [
      new FogSpriteLayer(this.group, this.camera, {
        name: 'fog-sprite-fog-element',
        textureUrl: fogElementUrl,
        count: fogCount,
        seed: 0.37,
        z: FOG_LAYER_Z,
        renderOrder: 2,
        settings: this.settings
      }),
      new FogSpriteLayer(this.group, this.camera, {
        name: 'fog-sprite-dense-fog-element',
        textureUrl: denseFogElementUrl,
        count: denseCount,
        seed: 9.73,
        z: DENSE_LAYER_Z,
        renderOrder: 3,
        settings: this.settings
      })
    ];
  }

  private clearSpriteLayers() {
    this.layers.forEach((layer) => {
      layer.dispose();
    });
    this.layers = [];
  }
}

function wrapOffset(value: number) {
  return THREE.MathUtils.euclideanModulo(value + 1, 2) - 1;
}
