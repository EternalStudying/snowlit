import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { WEATHER_NIGHT_SKY_BUDGET } from '../../core/weatherPerformanceBudget';
import { MeteorLayer } from './MeteorLayer';
import { MilkyWayLayer } from './MilkyWayLayer';
import { MoonLayer } from './MoonLayer';
import type { NightSkyRenderProfile } from './nightSkyProfile';
import { SkyDomeLayer } from './SkyDomeLayer';
import { StarfieldLayer } from './StarfieldLayer';

type NightSkyChildLayer = {
  setRenderProfile(profile: NightSkyRenderProfile): void;
  update(frame: WeatherFrameState, runtime: WeatherRuntimeState): void;
  dispose(): void;
};

export class NightSkyLayer {
  private readonly group = new THREE.Group();
  private readonly layers: NightSkyChildLayer[] = [];
  private activeKey = '';

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: NightSkyRenderProfile
  ) {
    this.group.name = 'night-sky-system';
    this.group.renderOrder = -30;
    this.scene.add(this.group);
    this.rebuild();
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    const nextKey = this.createKey(profile);
    this.profile = profile;

    if (nextKey !== this.activeKey) {
      this.rebuild();
      return;
    }

    this.layers.forEach((layer) => layer.setRenderProfile(profile));
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const { nightSkyVisibility, starVisibilityMultiplier, meteorVisibilityMultiplier } = runtime.orchestration;
    this.layers.forEach((layer) => layer.update(frame, runtime));
    this.group.visible = nightSkyVisibility > 0.01 || starVisibilityMultiplier > 0.01 || meteorVisibilityMultiplier > 0.01;
  }

  dispose() {
    this.clearLayers();
    this.group.removeFromParent();
  }

  private rebuild() {
    this.clearLayers();
    this.activeKey = this.createKey(this.profile);

    if (!this.profile.enabled) {
      return;
    }

    this.layers.push(new SkyDomeLayer(this.group, this.camera, this.profile));

    if (this.profile.milkyWayOpacity > 0.02) {
      this.layers.push(new MilkyWayLayer(this.group, this.camera, this.profile));
    }

    if (this.profile.starCount > 0) {
      this.layers.push(new StarfieldLayer(this.group, this.profile));
    }

    if (this.profile.moonOpacity > 0.03) {
      this.layers.push(new MoonLayer(this.group, this.camera, this.profile));
    }

    if (this.profile.meteorRate > 0 && this.profile.meteorMaxActive > 0) {
      this.layers.push(new MeteorLayer(this.group, this.camera, this.profile));
    }

    if (this.layers.length > WEATHER_NIGHT_SKY_BUDGET.maxRenderableMeshes) {
      throw new Error('Night sky renderable budget exceeded');
    }
  }

  private createKey(profile: NightSkyRenderProfile) {
    return [
      profile.enabled,
      profile.mode,
      profile.starCount,
      profile.milkyWayOpacity > 0.02,
      profile.moonOpacity > 0.03,
      profile.meteorRate > 0,
      profile.meteorMaxActive,
      profile.meteorShower
    ].join(':');
  }

  private clearLayers() {
    this.layers.forEach((layer) => layer.dispose());
    this.layers.length = 0;
  }
}
