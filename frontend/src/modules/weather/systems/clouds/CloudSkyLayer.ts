import * as THREE from 'three';
import type { SkyProfile } from '../../profiles/skyProfiles';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { getViewportSizeAtDepth } from '../shared/viewportPlane';
import { cloudSkyFragmentShader, cloudSkyVertexShader } from './cloudShaders';
import type { CloudLightingProfile } from './cloudLightingProfile';
import { getCloudLayerProfile, type CloudLayerProfile } from './cloudLayerProfiles';
import dghezCloudNoiseUrl from '../../effects/clouds/assets/dghez-cloud-noise.webp?url';
import dghezCloudShapeUrl from '../../effects/clouds/assets/dghez-cloud-shape.webp?url';

const DGHEZ_CLOUD_SHAPE_URL = dghezCloudShapeUrl;
const DGHEZ_CLOUD_NOISE_URL = dghezCloudNoiseUrl;
const CLOUD_DEPTH = -5.75;

type CloudPuffConfig = {
  y: number;
  width: number;
  aspectRatio: number;
  rotation: number;
  opacity: number;
  brightness: number;
  uFac1: number;
  uFac2: number;
  uTimeFactor1: number;
  uTimeFactor2: number;
  uDisplStrenght1: number;
  uDisplStrenght2: number;
  timeOffset: number;
  driftSeed: number;
  driftDuration: number;
  verticalDrift: number;
};

type CloudPuff = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  config: CloudPuffConfig;
};

const CLOUD_PUFF_BASE = {
  uFac1: 18,
  uTimeFactor1: 0.002,
  uDisplStrenght1: 0.04,
  uTimeFactor2: 0.0015,
  uFac2: 2.7,
  uDisplStrenght2: 0.08
} as const;

const ORDINARY_PUFF_DRIFT_DURATION = 62;

const PARTLY_CLOUDY_PUFF_CONFIGS: CloudPuffConfig[] = [
  {
    y: -0.36,
    width: 0.36,
    aspectRatio: 2.08,
    rotation: -0.045,
    opacity: 0.8,
    brightness: 1.13,
    uFac1: CLOUD_PUFF_BASE.uFac1 - 0.35,
    uFac2: CLOUD_PUFF_BASE.uFac2 - 0.1,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 - 0.0001,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 + 0.00007,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 - 0.002,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 + 0.003,
    timeOffset: 11,
    driftSeed: 0.12,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.01
  },
  {
    y: 0.1,
    width: 0.29,
    aspectRatio: 1.78,
    rotation: 0.032,
    opacity: 0.84,
    brightness: 1.14,
    uFac1: CLOUD_PUFF_BASE.uFac1 + 0.22,
    uFac2: CLOUD_PUFF_BASE.uFac2 + 0.07,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 + 0.00009,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 - 0.00005,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 + 0.0015,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 - 0.004,
    timeOffset: 47,
    driftSeed: 0.24,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.008
  },
  {
    y: 0.42,
    width: 0.33,
    aspectRatio: 1.96,
    rotation: -0.018,
    opacity: 0.78,
    brightness: 1.12,
    uFac1: CLOUD_PUFF_BASE.uFac1 + 0.48,
    uFac2: CLOUD_PUFF_BASE.uFac2 + 0.14,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 - 0.00004,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 + 0.0001,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 + 0.003,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 - 0.002,
    timeOffset: 89,
    driftSeed: 0.42,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.012
  },
  {
    y: -0.08,
    width: 0.27,
    aspectRatio: 1.62,
    rotation: 0.024,
    opacity: 0.76,
    brightness: 1.1,
    uFac1: CLOUD_PUFF_BASE.uFac1 - 0.12,
    uFac2: CLOUD_PUFF_BASE.uFac2 - 0.03,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 + 0.00012,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 - 0.00008,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 - 0.001,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 + 0.006,
    timeOffset: 131,
    driftSeed: 0.62,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.009
  },
  {
    y: 0.3,
    width: 0.31,
    aspectRatio: 1.86,
    rotation: -0.028,
    opacity: 0.82,
    brightness: 1.13,
    uFac1: CLOUD_PUFF_BASE.uFac1 + 0.36,
    uFac2: CLOUD_PUFF_BASE.uFac2 + 0.1,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 - 0.00008,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 + 0.00006,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 + 0.002,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 - 0.003,
    timeOffset: 173,
    driftSeed: 0.82,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.011
  }
];

const OVERCAST_CLOUD_PUFF_CONFIGS: CloudPuffConfig[] = [
  {
    ...PARTLY_CLOUDY_PUFF_CONFIGS[0],
    opacity: 0.76,
    width: 0.34,
    aspectRatio: 2.05,
    y: -0.36,
    driftSeed: 0.11,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION
  },
  {
    ...PARTLY_CLOUDY_PUFF_CONFIGS[1],
    opacity: 0.82,
    width: 0.29,
    aspectRatio: 1.82,
    y: 0.08,
    driftSeed: 0.18,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION
  },
  {
    ...PARTLY_CLOUDY_PUFF_CONFIGS[2],
    opacity: 0.78,
    width: 0.31,
    aspectRatio: 1.94,
    y: 0.43,
    driftSeed: 0.32,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION
  },
  {
    ...PARTLY_CLOUDY_PUFF_CONFIGS[3],
    y: -0.14,
    width: 0.27,
    aspectRatio: 1.66,
    opacity: 0.76,
    driftSeed: 0.46,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION
  },
  {
    ...PARTLY_CLOUDY_PUFF_CONFIGS[4],
    y: 0.31,
    width: 0.33,
    aspectRatio: 2,
    opacity: 0.8,
    driftSeed: 0.6,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION
  },
  {
    y: -0.28,
    width: 0.26,
    aspectRatio: 1.58,
    rotation: 0.014,
    opacity: 0.78,
    brightness: 1.1,
    uFac1: CLOUD_PUFF_BASE.uFac1 - 0.28,
    uFac2: CLOUD_PUFF_BASE.uFac2 + 0.04,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 + 0.00004,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 - 0.00004,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 - 0.0015,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 + 0.004,
    timeOffset: 217,
    driftSeed: 0.74,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.008
  },
  {
    y: 0.18,
    width: 0.3,
    aspectRatio: 1.88,
    rotation: -0.02,
    opacity: 0.84,
    brightness: 1.13,
    uFac1: CLOUD_PUFF_BASE.uFac1 + 0.16,
    uFac2: CLOUD_PUFF_BASE.uFac2 - 0.08,
    uTimeFactor1: CLOUD_PUFF_BASE.uTimeFactor1 - 0.00002,
    uTimeFactor2: CLOUD_PUFF_BASE.uTimeFactor2 + 0.00009,
    uDisplStrenght1: CLOUD_PUFF_BASE.uDisplStrenght1 + 0.0025,
    uDisplStrenght2: CLOUD_PUFF_BASE.uDisplStrenght2 - 0.001,
    timeOffset: 251,
    driftSeed: 0.88,
    driftDuration: ORDINARY_PUFF_DRIFT_DURATION,
    verticalDrift: 0.009
  }
];

export class CloudSkyLayer {
  private readonly group = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(1, 1, 5, 5);
  private readonly cloudShapeTexture = this.createCloudTexture(DGHEZ_CLOUD_SHAPE_URL, false);
  private readonly cloudNoiseTexture = this.createCloudTexture(DGHEZ_CLOUD_NOISE_URL, true);
  private readonly clouds: CloudPuff[];
  private skyProfile: SkyProfile;
  private semanticProfile: CloudLayerProfile;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    skyProfile: SkyProfile,
    private lightingProfile: CloudLightingProfile
  ) {
    this.skyProfile = skyProfile;
    this.semanticProfile = getCloudLayerProfile(skyProfile.cloud.primary);

    this.group.name = 'cloud-sky-system';

    this.clouds = this.selectCloudConfigs().map((config, index) =>
      this.createCloud(config, index)
    );
    this.clouds.forEach(({ mesh }) => this.group.add(mesh));
    this.scene.add(this.group);

    this.syncViewport(0);
    this.updateUniforms(0, 1);
  }

  setSkyProfile(skyProfile: SkyProfile, lightingProfile: CloudLightingProfile) {
    this.skyProfile = skyProfile;
    this.lightingProfile = lightingProfile;
    this.semanticProfile = getCloudLayerProfile(skyProfile.cloud.primary);
    this.syncViewport(0);
    this.updateUniforms(0, 1);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncViewport(frame.elapsed);
    this.updateUniforms(frame.elapsed, runtime.particleIntensity, runtime);
  }

  dispose() {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.clouds.forEach(({ mesh, material }) => {
      this.group.remove(mesh);
      material.dispose();
    });
    this.geometry.dispose();
    this.cloudShapeTexture.dispose();
    this.cloudNoiseTexture.dispose();
    this.group.removeFromParent();
  }

  private createCloud(config: CloudPuffConfig, index: number): CloudPuff {
    const material = this.createMaterial(config);
    const mesh = new THREE.Mesh(this.geometry, material);

    mesh.name = index === 0 ? 'cloud-sky-dghez-cloud' : `cloud-sky-dghez-cloud-${index + 1}`;
    mesh.renderOrder = 10 + index * 0.01;
    mesh.frustumCulled = false;
    mesh.userData.cloudDriftSeed = config.driftSeed;
    mesh.userData.cloudTimeOffset = config.timeOffset;
    mesh.userData.cloudPuffDuration = config.driftDuration;

    return { mesh, material, config };
  }

  private createMaterial(config: CloudPuffConfig) {
    return new THREE.ShaderMaterial({
      uniforms: {
        rotation: { value: config.rotation },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: config.timeOffset },
        uTxtShape: { value: this.cloudShapeTexture },
        uTxtCloudNoise: { value: this.cloudNoiseTexture },
        uFac1: { value: config.uFac1 },
        uFac2: { value: config.uFac2 },
        uTimeFactor1: { value: config.uTimeFactor1 },
        uTimeFactor2: { value: config.uTimeFactor2 },
        uDisplStrenght1: { value: config.uDisplStrenght1 },
        uDisplStrenght2: { value: config.uDisplStrenght2 },
        uOpacity: { value: 0 },
        uBrightness: { value: config.brightness }
      },
      vertexShader: cloudSkyVertexShader,
      fragmentShader: cloudSkyFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });
  }

  private updateUniforms(elapsed: number, particleIntensity: number, runtime?: WeatherRuntimeState) {
    const cloudVisibility = runtime ? runtime.orchestration.cloudVisibility : 1;
    const cloudOcclusion = runtime ? runtime.orchestration.cloudOcclusion : 0;
    const overlayAlphaBoost = 1.8;
    const variantOpacity = 1;
    const profileOpacity =
      this.skyProfile.cloud.opacity *
      this.semanticProfile.opacity *
      (1.12 + this.skyProfile.cloud.density * 0.28) *
      (0.92 + particleIntensity * 0.08) *
      overlayAlphaBoost *
      variantOpacity;

    this.clouds.forEach(({ material, config }) => {
      material.uniforms.uTime.value = elapsed * 60 + config.timeOffset;
      material.uniforms.uOpacity.value = THREE.MathUtils.clamp(
        profileOpacity * config.opacity * cloudVisibility * (1 - cloudOcclusion * 0.18),
        0,
        2.6
      );
      material.uniforms.uBrightness.value = THREE.MathUtils.clamp(
        config.brightness - cloudOcclusion * 0.06,
        1.03,
        1.18
      );
    });
  }

  private syncViewport(elapsed: number) {
    const viewport = getViewportSizeAtDepth(this.camera, CLOUD_DEPTH);
    const coverage = THREE.MathUtils.clamp(this.skyProfile.cloud.coverage * this.semanticProfile.coverage, 0.12, 1);
    const variantScale = this.skyProfile.cloud.mood === 'overcast' ? 1.08 : 0.98;
    this.clouds.forEach(({ mesh, config }) => {
      const cloudWidth = viewport.width * config.width * (0.9 + coverage * 0.22) * variantScale;
      const cloudHeight = cloudWidth / config.aspectRatio;
      const startOutside = -viewport.width / 2 - cloudWidth / 2;
      const endOutside = viewport.width / 2 + cloudWidth / 2;
      const driftProgress = THREE.MathUtils.euclideanModulo(config.driftSeed + elapsed / config.driftDuration, 1);
      const driftX = THREE.MathUtils.lerp(startOutside, endOutside, driftProgress);
      const bobY = Math.sin(elapsed * 0.12 + config.driftSeed * Math.PI * 2) * viewport.height * config.verticalDrift;

      mesh.scale.set(cloudWidth, cloudHeight, 1);
      mesh.position.set(driftX, viewport.height * config.y + bobY, CLOUD_DEPTH);
      mesh.userData.cloudPuffStartX = startOutside;
      mesh.userData.cloudPuffEndX = endOutside;
      mesh.userData.cloudPuffProgress = driftProgress;
    });
  }

  private selectCloudConfigs() {
    return this.skyProfile.cloud.mood === 'overcast' ? OVERCAST_CLOUD_PUFF_CONFIGS : PARTLY_CLOUDY_PUFF_CONFIGS;
  }

  private createCloudTexture(url: string, repeat: boolean) {
    const texture = new THREE.TextureLoader().load(url);

    texture.name = repeat ? 'dghez-cloud-noise-texture' : 'dghez-cloud-shape-texture';
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return texture;
  }
}
