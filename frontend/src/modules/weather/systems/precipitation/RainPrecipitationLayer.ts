import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS } from '../../core/weatherPerformanceBudget';
import type { WindSystem } from '../../core/WindSystem';
import { rainFragmentShader, rainVertexShader } from '../../effects/rain/rainShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

const RAIN_DROP_COUNT = WEATHER_PARTICLE_COUNTS.rain;
const RAIN_SPAWN_RADIUS = 13.5;
const RAIN_SPAWN_HEIGHT = 12.8;
const RAIN_DROP_LENGTH = 0.32;
const RAIN_GRAVITY = -13.4;
const RAIN_WIND_FORCE_SCALE = 8;

export class RainPrecipitationLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly rainMaterial: THREE.ShaderMaterial;
  private readonly scaledWind = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.group.name = 'rain-precipitation-system';
    this.scene.add(this.group);
    this.rainMaterial = this.createRainLines();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.rainMaterial.uniforms.intensity.value = profile.particleIntensity;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.scaledWind.copy(this.wind.force).multiplyScalar(RAIN_WIND_FORCE_SCALE);
    this.rainMaterial.uniforms.time.value = frame.elapsed;
    this.rainMaterial.uniforms.intensity.value = runtime.rainIntensity;
    this.rainMaterial.uniforms.windForce.value.copy(this.scaledWind);
    this.rainMaterial.uniforms.cameraPos.value.copy(this.camera.position);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      const line = object as THREE.LineSegments;
      const geometry = line.geometry;
      const material = line.material as DisposableMaterial | DisposableMaterial[] | undefined;

      if (geometry) {
        geometry.dispose();
      }

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else if (material) {
        material.dispose();
      }
    });
  }

  private createRainLines() {
    const positions = new Float32Array(RAIN_DROP_COUNT * 6);
    const drops = new Float32Array(RAIN_DROP_COUNT * 8);

    for (let index = 0; index < RAIN_DROP_COUNT; index += 1) {
      const x = (Math.random() - 0.5) * RAIN_SPAWN_RADIUS * 2;
      const y = (Math.random() - 0.5) * RAIN_SPAWN_HEIGHT;
      const depth = Math.random();
      const z = -0.85 - depth * 8.4;
      const seed = Math.random();
      const phase = Math.random();

      for (let vertex = 0; vertex < 2; vertex += 1) {
        const positionOffset = index * 6 + vertex * 3;
        const dropOffset = index * 8 + vertex * 4;
        positions[positionOffset] = x;
        positions[positionOffset + 1] = y;
        positions[positionOffset + 2] = z;
        drops[dropOffset] = seed;
        drops[dropOffset + 1] = phase;
        drops[dropOffset + 2] = depth;
        drops[dropOffset + 3] = vertex;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aDrop', new THREE.BufferAttribute(drops, 4));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        windForce: { value: new THREE.Vector3() },
        gravity: { value: RAIN_GRAVITY },
        spawnHeight: { value: RAIN_SPAWN_HEIGHT },
        spawnRadius: { value: RAIN_SPAWN_RADIUS },
        dropLength: { value: RAIN_DROP_LENGTH },
        opacity: { value: 0.34 },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: rainVertexShader,
      fragmentShader: rainFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    const rain = new THREE.LineSegments(geometry, material);
    rain.renderOrder = 2;
    rain.frustumCulled = false;
    this.group.add(rain);
    return material;
  }
}
