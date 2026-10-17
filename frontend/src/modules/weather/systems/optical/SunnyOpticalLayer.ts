import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS, WEATHER_PIXEL_RATIO_CAP } from '../../core/weatherPerformanceBudget';
import type { WindSystem } from '../../core/WindSystem';
import {
  sunnyBeamVertexShader,
  sunnyDustFragmentShader,
  sunnyDustVertexShader,
  sunnyHaloFragmentShader,
  sunnyRadialRayFragmentShader
} from '../../effects/sunny/sunnyShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

const UPPER_LEFT_SUN_POSITION = new THREE.Vector3(-5.32, 3.12, -3.15);
const DUST_PARTICLE_COUNT = WEATHER_PARTICLE_COUNTS.sunnyDust;
const DUST_VIEWPORT_FILL_SCALE_X = 1.3;
const DUST_VIEWPORT_FILL_SCALE_Y = 1.24;

export class SunnyOpticalLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly dustMaterial: THREE.ShaderMaterial;
  private readonly beamMaterials: THREE.ShaderMaterial[] = [];
  private readonly sunMaterials: THREE.ShaderMaterial[] = [];
  private readonly parallax = new THREE.Vector2();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.group.name = 'sunny-optical-system';
    this.scene.add(this.group);
    this.createLightBeams();
    this.dustMaterial = this.createDustParticles();
    this.createUpperLeftSun();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const visibility = runtime.orchestration.sunnyOpticalVisibility;
    this.updateParallax(frame.pointer, frame.scrollY);
    this.group.position.x = this.parallax.x;
    this.group.position.y = this.parallax.y;

    this.beamMaterials.forEach((material) => {
      material.uniforms.time.value = frame.elapsed;
      material.uniforms.opacity.value = 0.36 * visibility;
    });
    this.dustMaterial.uniforms.time.value = frame.elapsed;
    this.dustMaterial.uniforms.windForce.value.copy(this.wind.force);
    this.dustMaterial.uniforms.parallax.value.copy(this.parallax);
    this.sunMaterials.forEach((material, index) => {
      material.uniforms.time.value = frame.elapsed;
      material.uniforms.opacity.value = (index === 0 ? 0.34 : 0.62) * visibility;
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh | THREE.Points;
      mesh.geometry?.dispose();
      const material = mesh.material as DisposableMaterial | DisposableMaterial[] | undefined;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
  }

  private updateParallax(pointer: { x: number; y: number }, scrollY: number) {
    this.parallax.set(pointer.x * 0.18, -pointer.y * 0.12 + Math.sin(scrollY * 0.0016) * 0.04);
  }

  private createLightBeams() {
    this.createRadialLightRays();
  }

  private createRadialLightRays() {
    const rayZ = -3.82;
    const viewport = this.getViewportSizeAtDepth(rayZ);
    const width = viewport.width * 1.08;
    const height = viewport.height * 1.08;
    const sunUv = this.getUvForPosition(UPPER_LEFT_SUN_POSITION, width, height);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunUv: { value: sunUv },
        rayColor: { value: new THREE.Color(0xffb66a).convertSRGBToLinear() },
        opacity: { value: 0.36 }
      },
      vertexShader: sunnyBeamVertexShader,
      fragmentShader: sunnyRadialRayFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const rays = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    rays.position.set(0, 0, rayZ);
    rays.frustumCulled = false;
    this.beamMaterials.push(material);
    this.group.add(rays);
  }

  private createDustParticles() {
    const particleCount = DUST_PARTICLE_COUNT;
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);
    const depths = new Float32Array(particleCount);

    for (let index = 0; index < particleCount; index += 1) {
      const depth = Math.random();
      const z = -1.35 - depth * 5.35;
      const viewport = this.getViewportSizeAtDepth(z);
      positions[index * 3] = (Math.random() - 0.5) * viewport.width * DUST_VIEWPORT_FILL_SCALE_X;
      positions[index * 3 + 1] = (Math.random() - 0.5) * viewport.height * DUST_VIEWPORT_FILL_SCALE_Y;
      positions[index * 3 + 2] = z;
      sizes[index] = 0.9 + Math.random() * 1.85;
      phases[index] = Math.random() * Math.PI * 2;
      depths[index] = depth;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: Math.min(window.devicePixelRatio || 1, WEATHER_PIXEL_RATIO_CAP) },
        windForce: { value: new THREE.Vector3() },
        parallax: { value: new THREE.Vector2() }
      },
      vertexShader: sunnyDustVertexShader,
      fragmentShader: sunnyDustFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.group.add(points);
    return material;
  }

  private createUpperLeftSun() {
    this.createSunGlow(4.2, 0xffb85c, 0.34, UPPER_LEFT_SUN_POSITION);
    this.createSunGlow(
      0.82,
      0xffdd94,
      0.62,
      new THREE.Vector3(UPPER_LEFT_SUN_POSITION.x + 0.08, UPPER_LEFT_SUN_POSITION.y - 0.04, -3.05)
    );
  }

  private createSunGlow(size: number, color: number, opacity: number, position: THREE.Vector3) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        haloColor: { value: new THREE.Color(color).convertSRGBToLinear() },
        opacity: { value: opacity }
      },
      vertexShader: sunnyBeamVertexShader,
      fragmentShader: sunnyHaloFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
    glow.position.copy(position);
    glow.frustumCulled = false;
    this.sunMaterials.push(material);
    this.group.add(glow);
  }

  private getViewportSizeAtDepth(z: number) {
    const distance = Math.abs(this.camera.position.z - z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;

    return {
      width: height * this.camera.aspect,
      height
    };
  }

  private getUvForPosition(position: THREE.Vector3, width: number, height: number) {
    return new THREE.Vector2(position.x / width + 0.5, position.y / height + 0.5);
  }
}
