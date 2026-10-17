import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS } from '../../core/weatherPerformanceBudget';
import { rainSplashFragmentShader, rainSplashVertexShader } from '../../effects/rain/rainSplashShaders';
import {
  disposeObjectTree,
  fillBottomEdgePositions,
  syncBottomEdgePositions,
  type ViewportPlaneState
} from '../shared/viewportPlane';

const SPLASH_Z = -3.4;
const SPLASH_COUNT = WEATHER_PARTICLE_COUNTS.rainSplash;
const BOTTOM_SPLASH_BAND = [0.2, 0.32] as const;

export class RainSplashLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private positionAttribute!: THREE.BufferAttribute;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'rain-splash-precipitation-system';
    this.scene.add(this.group);
    this.material = this.createSplashes();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.material.uniforms.intensity.value = profile.particleIntensity;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncSplashPositions();
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = runtime.rainIntensity;
    this.material.uniforms.opacity.value = 0.16 + Math.min(runtime.rainIntensity, 1) * 0.18;
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createSplashes() {
    const positions = new Float32Array(SPLASH_COUNT * 3);
    const seeds = new Float32Array(SPLASH_COUNT * 4);
    fillBottomEdgePositions(positions, this.camera, {
      z: SPLASH_Z,
      count: SPLASH_COUNT,
      widthScale: 1.14,
      bottomBand: BOTTOM_SPLASH_BAND,
      depthRange: 1.1
    });

    for (let index = 0; index < SPLASH_COUNT; index += 1) {
      const seedOffset = index * 4;
      seeds[seedOffset] = Math.random();
      seeds[seedOffset + 1] = Math.random();
      seeds[seedOffset + 2] = 0.56 + Math.random() * 1.26;
      seeds[seedOffset + 3] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    const positionAttribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        pointSize: { value: 2.1 },
        opacity: { value: 0.24 }
      },
      vertexShader: rainSplashVertexShader,
      fragmentShader: rainSplashFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 6;
    points.frustumCulled = false;
    this.group.add(points);
    this.positionAttribute = positionAttribute;
    this.syncSplashPositions();
    return material;
  }

  private syncSplashPositions() {
    this.viewportState = syncBottomEdgePositions(this.positionAttribute, this.camera, this.viewportState, {
      z: SPLASH_Z,
      count: SPLASH_COUNT,
      widthScale: 1.14,
      bottomBand: BOTTOM_SPLASH_BAND,
      depthRange: 1.1
    });
  }
}
