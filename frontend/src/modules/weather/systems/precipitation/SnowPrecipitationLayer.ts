import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS } from '../../core/weatherPerformanceBudget';
import type { WindSystem } from '../../core/WindSystem';
import { snowFragmentShader, snowVertexShader } from '../../effects/snow/snowShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

type SnowSettings = {
  count: number;
  spawnRadius: number;
  spawnHeight: number;
  gravity: number;
  flutterAmp: number;
  pointSize: number;
  opacity: number;
  windTravelScale: number;
  windStretch: number;
};

const SNOW_WIND_FORCE_SCALE = 6.2;

const SNOW_SETTINGS: Record<string, SnowSettings> = {
  lightSnow: {
    count: WEATHER_PARTICLE_COUNTS.snow.lightSnow,
    spawnRadius: 14.6,
    spawnHeight: 13.4,
    gravity: -1.2,
    flutterAmp: 2.15,
    pointSize: 2.45,
    opacity: 0.58,
    windTravelScale: 0.78,
    windStretch: 0.08
  },
  snow: {
    count: WEATHER_PARTICLE_COUNTS.snow.snow,
    spawnRadius: 15.2,
    spawnHeight: 13.8,
    gravity: -1.78,
    flutterAmp: 1.55,
    pointSize: 3.05,
    opacity: 0.58,
    windTravelScale: 1,
    windStretch: 0.28
  },
  blizzard: {
    count: WEATHER_PARTICLE_COUNTS.snow.blizzard,
    spawnRadius: 16.8,
    spawnHeight: 14.4,
    gravity: -2.55,
    flutterAmp: 0.58,
    pointSize: 3.85,
    opacity: 0.48,
    windTravelScale: 1.72,
    windStretch: 1.18
  }
};

export class SnowPrecipitationLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly snowMaterial: THREE.ShaderMaterial;
  private readonly scaledWind = new THREE.Vector3();
  private settings: SnowSettings;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.settings = SNOW_SETTINGS[profile.weatherState] ?? SNOW_SETTINGS.snow;
    this.group.name = 'snow-precipitation-system';
    this.scene.add(this.group);
    this.snowMaterial = this.createSnowParticles();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.settings = SNOW_SETTINGS[profile.weatherState] ?? SNOW_SETTINGS.snow;
    this.snowMaterial.uniforms.gravity.value = this.settings.gravity;
    this.snowMaterial.uniforms.flutterAmp.value = this.settings.flutterAmp;
    this.snowMaterial.uniforms.pointSize.value = this.settings.pointSize;
    this.snowMaterial.uniforms.windTravelScale.value = this.settings.windTravelScale;
    this.snowMaterial.uniforms.windStretch.value = this.settings.windStretch;
    this.snowMaterial.uniforms.opacity.value = this.settings.opacity;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.scaledWind.copy(this.wind.force).multiplyScalar(SNOW_WIND_FORCE_SCALE);
    this.snowMaterial.uniforms.time.value = frame.elapsed;
    this.snowMaterial.uniforms.intensity.value = runtime.snowIntensity;
    this.snowMaterial.uniforms.windForce.value.copy(this.scaledWind);
    this.snowMaterial.uniforms.cameraPos.value.copy(this.camera.position);
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

  private createSnowParticles() {
    const positions = new Float32Array(this.settings.count * 3);
    const seeds = new Float32Array(this.settings.count * 4);

    for (let index = 0; index < this.settings.count; index += 1) {
      const depth = Math.random();
      const positionOffset = index * 3;
      const seedOffset = index * 4;

      positions[positionOffset] = (Math.random() - 0.5) * this.settings.spawnRadius * 2;
      positions[positionOffset + 1] = (Math.random() - 0.5) * this.settings.spawnHeight;
      positions[positionOffset + 2] = -0.7 - depth * 8.8;
      seeds[seedOffset] = Math.random();
      seeds[seedOffset + 1] = Math.random() * Math.PI * 2;
      seeds[seedOffset + 2] = 0.64 + Math.random() * 1.55;
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
        gravity: { value: this.settings.gravity },
        spawnHeight: { value: this.settings.spawnHeight },
        spawnRadius: { value: this.settings.spawnRadius },
        flutterAmp: { value: this.settings.flutterAmp },
        pointSize: { value: this.settings.pointSize },
        windTravelScale: { value: this.settings.windTravelScale },
        windStretch: { value: this.settings.windStretch },
        opacity: { value: this.settings.opacity },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: snowVertexShader,
      fragmentShader: snowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });

    const snow = new THREE.Points(geometry, material);
    snow.renderOrder = 3;
    snow.frustumCulled = false;
    this.group.add(snow);
    return material;
  }
}
