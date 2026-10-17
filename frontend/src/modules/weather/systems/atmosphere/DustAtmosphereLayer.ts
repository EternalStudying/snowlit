import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { WEATHER_PARTICLE_COUNTS } from '../../core/weatherPerformanceBudget';
import type { WindSystem } from '../../core/WindSystem';
import {
  sandstormParticleFragmentShader,
  sandstormParticleVertexShader,
  sandstormPlaneFragmentShader,
  sandstormPlaneVertexShader
} from '../../effects/sandstorm/sandstormShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

type SandstormSettings = {
  count: number;
  spawnRadius: number;
  spawnHeight: number;
  dustColor: number;
  hazeOpacity: number;
  gustOpacity: number;
  particleOpacity: number;
  pointSize: number;
  swirlStrength: number;
  windForceScale: number;
  windTravelScale: number;
  centerProtection: number;
  noiseScale: number;
};

type GustBandConfig = {
  name: string;
  opacityRole: 'hazeOpacity' | 'gustOpacity';
  z: number;
  x: number;
  y: number;
  widthScale: number;
  heightScale: number;
  opacity: number;
  bandStrength: number;
  seed: number;
  renderOrder: number;
};

const DUST_SAND_SETTINGS: SandstormSettings = {
  count: WEATHER_PARTICLE_COUNTS.sand.dust,
  spawnRadius: 15.8,
  spawnHeight: 11.4,
  dustColor: 0xd2bd7c,
  hazeOpacity: 0.1,
  gustOpacity: 0.1,
  particleOpacity: 0.2,
  pointSize: 2.45,
  swirlStrength: 0.68,
  windForceScale: 8.2,
  windTravelScale: 1.08,
  centerProtection: 0.54,
  noiseScale: 4.6
};

const SANDSTORM_SETTINGS: SandstormSettings = {
  count: WEATHER_PARTICLE_COUNTS.sand.sandstorm,
  spawnRadius: 17.6,
  spawnHeight: 12.4,
  dustColor: 0xc18442,
  hazeOpacity: 0.34,
  gustOpacity: 0.3,
  particleOpacity: 0.5,
  pointSize: 3.7,
  swirlStrength: 1.18,
  windForceScale: 10.6,
  windTravelScale: 1.54,
  centerProtection: 0.42,
  noiseScale: 3.7
};

export class DustAtmosphereLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly particleMaterial: THREE.ShaderMaterial;
  private readonly planeMaterials: Array<{
    material: THREE.ShaderMaterial;
    opacityRole: GustBandConfig['opacityRole'];
    opacityScale: number;
  }> = [];
  private readonly scaledWind = new THREE.Vector3();
  private settings: SandstormSettings;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly wind: WindSystem,
    private profile: WeatherProfile
  ) {
    this.settings = this.profile.weatherVariant === 'dust' ? DUST_SAND_SETTINGS : SANDSTORM_SETTINGS;
    this.group.name = 'dust-atmosphere-system';
    this.scene.add(this.group);
    this.createHazePlane();
    this.createGustBands();
    this.particleMaterial = this.createDustParticles();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.settings = this.profile.weatherVariant === 'dust' ? DUST_SAND_SETTINGS : SANDSTORM_SETTINGS;
    const dustColor = new THREE.Color(this.settings.dustColor).convertSRGBToLinear();

    this.particleMaterial.uniforms.dustColor.value.copy(dustColor);
    this.particleMaterial.uniforms.opacity.value = this.settings.particleOpacity;
    this.particleMaterial.uniforms.pointSize.value = this.settings.pointSize;
    this.particleMaterial.uniforms.spawnRadius.value = this.settings.spawnRadius;
    this.particleMaterial.uniforms.spawnHeight.value = this.settings.spawnHeight;
    this.particleMaterial.uniforms.swirlStrength.value = this.settings.swirlStrength;
    this.particleMaterial.uniforms.windTravelScale.value = this.settings.windTravelScale;
    this.planeMaterials.forEach(({ material, opacityRole, opacityScale }) => {
      material.uniforms.dustColor.value.copy(dustColor);
      material.uniforms.opacity.value = this.settings[opacityRole] * opacityScale;
      material.uniforms.noiseScale.value = this.settings.noiseScale;
      material.uniforms.centerProtection.value = this.settings.centerProtection;
    });
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.scaledWind.copy(this.wind.force).multiplyScalar(this.settings.windForceScale);
    this.particleMaterial.uniforms.time.value = frame.elapsed;
    this.particleMaterial.uniforms.intensity.value = runtime.particleIntensity;
    this.particleMaterial.uniforms.windForce.value.copy(this.scaledWind);
    this.particleMaterial.uniforms.cameraPos.value.copy(this.camera.position);

    this.planeMaterials.forEach(({ material, opacityRole, opacityScale }) => {
      material.uniforms.time.value = frame.elapsed;
      material.uniforms.windForce.value.copy(this.scaledWind);
      material.uniforms.opacity.value = this.settings[opacityRole] * opacityScale * (0.62 + runtime.particleIntensity * 0.38);
    });
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      const mesh = object as THREE.Points | THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as DisposableMaterial | DisposableMaterial[] | undefined;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
    this.planeMaterials.length = 0;
  }

  private createDustParticles() {
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
      seeds[seedOffset + 2] = 0.58 + Math.random() * 1.45;
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
        dustColor: { value: new THREE.Color(this.settings.dustColor).convertSRGBToLinear() },
        opacity: { value: this.settings.particleOpacity },
        pointSize: { value: this.settings.pointSize },
        spawnRadius: { value: this.settings.spawnRadius },
        spawnHeight: { value: this.settings.spawnHeight },
        swirlStrength: { value: this.settings.swirlStrength },
        windTravelScale: { value: this.settings.windTravelScale },
        cameraPos: { value: new THREE.Vector3() }
      },
      vertexShader: sandstormParticleVertexShader,
      fragmentShader: sandstormParticleFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending
    });

    const dust = new THREE.Points(geometry, material);
    dust.renderOrder = 4;
    dust.frustumCulled = false;
    this.group.add(dust);
    return material;
  }

  private createHazePlane() {
    const z = -5.9;
    const viewport = this.getViewportSizeAtDepth(z);
    const material = this.createPlaneMaterial({
      opacity: this.settings.hazeOpacity,
      opacityRole: 'hazeOpacity',
      bandStrength: 0.1,
      seed: 0.35,
      noiseScale: this.settings.noiseScale
    });
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(viewport.width * 1.18, viewport.height * 1.16), material);
    haze.position.set(0, 0, z);
    haze.renderOrder = 1;
    haze.frustumCulled = false;
    this.group.add(haze);
  }

  private createGustBands() {
    const bands: GustBandConfig[] = [
      {
        name: 'high-gust',
        opacityRole: 'gustOpacity',
        z: -5.1,
        x: -0.06,
        y: 0.22,
        widthScale: 1.36,
        heightScale: 0.22,
        opacity: this.settings.gustOpacity * 0.72,
        bandStrength: 0.24,
        seed: 1.4,
        renderOrder: 2
      },
      {
        name: 'middle-gust',
        opacityRole: 'gustOpacity',
        z: -4.7,
        x: 0.08,
        y: 0.02,
        widthScale: 1.44,
        heightScale: 0.3,
        opacity: this.settings.gustOpacity,
        bandStrength: 0.34,
        seed: 2.1,
        renderOrder: 3
      },
      {
        name: 'low-gust',
        opacityRole: 'gustOpacity',
        z: -4.4,
        x: -0.12,
        y: -0.24,
        widthScale: 1.5,
        heightScale: 0.28,
        opacity: this.settings.gustOpacity * 0.86,
        bandStrength: 0.38,
        seed: 3.2,
        renderOrder: 3
      }
    ];

    bands.forEach((band) => this.createGustBand(band));
  }

  private createGustBand(band: GustBandConfig) {
    const viewport = this.getViewportSizeAtDepth(band.z);
    const material = this.createPlaneMaterial({
      opacity: band.opacity,
      opacityRole: band.opacityRole,
      bandStrength: band.bandStrength,
      seed: band.seed,
      noiseScale: this.settings.noiseScale * 1.2
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(viewport.width * band.widthScale, viewport.height * band.heightScale),
      material
    );
    mesh.name = `sandstorm-${band.name}`;
    mesh.position.set(viewport.width * band.x, viewport.height * band.y, band.z);
    mesh.renderOrder = band.renderOrder;
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  private createPlaneMaterial({
    opacity,
    opacityRole,
    bandStrength,
    seed,
    noiseScale
  }: {
    opacity: number;
    opacityRole: GustBandConfig['opacityRole'];
    bandStrength: number;
    seed: number;
    noiseScale: number;
  }) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        dustColor: { value: new THREE.Color(this.settings.dustColor).convertSRGBToLinear() },
        windForce: { value: new THREE.Vector3() },
        opacity: { value: opacity },
        bandStrength: { value: bandStrength },
        noiseScale: { value: noiseScale },
        centerProtection: { value: this.settings.centerProtection },
        layerSeed: { value: seed }
      },
      vertexShader: sandstormPlaneVertexShader,
      fragmentShader: sandstormPlaneFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    this.planeMaterials.push({
      material,
      opacityRole,
      opacityScale: opacity / this.settings[opacityRole]
    });
    return material;
  }

  private getViewportSizeAtDepth(z: number) {
    const distance = Math.abs(this.camera.position.z - z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;

    return {
      width: height * this.camera.aspect,
      height
    };
  }
}
