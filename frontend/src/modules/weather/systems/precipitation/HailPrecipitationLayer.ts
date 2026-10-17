import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS } from '../../core/weatherPerformanceBudget';
import type { WindSystem } from '../../core/WindSystem';
import { hailFragmentShader, hailVertexShader } from '../../effects/hail/hailShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

type HailSettings = {
  count: number;
  spawnRadius: number;
  spawnHeight: number;
  fallSpeed: number;
  pointSize: number;
  opacity: number;
  windForceScale: number;
};

const HAIL_SETTINGS: HailSettings = {
  count: WEATHER_PARTICLE_COUNTS.hail.hail,
  spawnRadius: 14.2,
  spawnHeight: 12.8,
  fallSpeed: 15.5,
  pointSize: 1.65,
  opacity: 0.66,
  windForceScale: 6.4
};

const HAIL_STORM_SETTINGS: HailSettings = {
  count: WEATHER_PARTICLE_COUNTS.hail.hailStorm,
  spawnRadius: 15.6,
  spawnHeight: 13.6,
  fallSpeed: 18.5,
  pointSize: 1.9,
  opacity: 0.74,
  windForceScale: 8.4
};

export class HailPrecipitationLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly scaledWind = new THREE.Vector3();
  private settings: HailSettings;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.settings = this.resolveSettings();
    this.group.name = 'hail-precipitation-system';
    this.scene.add(this.group);
    this.material = this.createHailParticles();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.settings = this.resolveSettings();
    this.material.uniforms.intensity.value = profile.particleIntensity;
    this.material.uniforms.fallSpeed.value = this.settings.fallSpeed;
    this.material.uniforms.pointSize.value = this.settings.pointSize;
    this.material.uniforms.opacity.value = this.settings.opacity;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.scaledWind.copy(this.wind.force).multiplyScalar(this.settings.windForceScale);
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = Math.max(runtime.particleIntensity, runtime.rainIntensity);
    this.material.uniforms.windForce.value.copy(this.scaledWind);
    this.material.uniforms.cameraPos.value.copy(this.camera.position);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      const points = object as THREE.Points;
      points.geometry?.dispose();
      const material = points.material as DisposableMaterial | DisposableMaterial[] | undefined;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
  }

  private resolveSettings() {
    return this.profile.weatherVariant === 'hailStorm' ? HAIL_STORM_SETTINGS : HAIL_SETTINGS;
  }

  private createHailParticles() {
    const positions = new Float32Array(this.settings.count * 3);
    const seeds = new Float32Array(this.settings.count * 4);

    for (let index = 0; index < this.settings.count; index += 1) {
      const depth = Math.random();
      const positionOffset = index * 3;
      const seedOffset = index * 4;
      positions[positionOffset] = (Math.random() - 0.5) * this.settings.spawnRadius * 2;
      positions[positionOffset + 1] = (Math.random() - 0.5) * this.settings.spawnHeight;
      positions[positionOffset + 2] = -0.65 - depth * 8.6;
      seeds[seedOffset] = Math.random();
      seeds[seedOffset + 1] = Math.random() * Math.PI * 2;
      seeds[seedOffset + 2] = 0.82 + Math.random() * 1.16;
      seeds[seedOffset + 3] = depth;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        windForce: { value: new THREE.Vector3() },
        spawnHeight: { value: this.settings.spawnHeight },
        spawnRadius: { value: this.settings.spawnRadius },
        fallSpeed: { value: this.settings.fallSpeed },
        pointSize: { value: this.settings.pointSize },
        opacity: { value: this.settings.opacity },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: hailVertexShader,
      fragmentShader: hailFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });

    const hail = new THREE.Points(geometry, material);
    hail.renderOrder = 4;
    hail.frustumCulled = false;
    this.group.add(hail);
    return material;
  }
}
