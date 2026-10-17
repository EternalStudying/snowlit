import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import {
  auroraFragmentShader,
  auroraVertexShader,
  auroraWashFragmentShader,
  auroraWashVertexShader
} from '../../effects/aurora/auroraShaders';
import { disposeObjectTree, getViewportSizeAtDepth, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const AURORA_WASH_Z = -6.2;
const AURORA_VIEWPORT_EPSILON = 0.0001;
const topCoverage = 0.62;

type AuroraCurtainConfig = {
  xOffsetScale: number;
  yOffsetScale: number;
  z: number;
  widthScale: number;
  heightScale: number;
  opacity: number;
  rotationZ: number;
};

type AuroraCurtain = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  config: AuroraCurtainConfig;
  viewportState?: ViewportPlaneState;
};

export class AuroraOpticalLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly auroraMaterials: THREE.ShaderMaterial[] = [];
  private readonly auroraCurtains: AuroraCurtain[] = [];
  private readonly washMaterial: THREE.ShaderMaterial;
  private washMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private washViewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'aurora-optical-system';
    this.scene.add(this.group);
    this.washMaterial = this.createNightWash();
    this.createCurtains();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const auroraVisibility = runtime.orchestration.auroraVisibility;
    this.syncNightWash();
    this.syncCurtains();
    this.auroraMaterials.forEach((material, index) => {
      material.uniforms.time.value = frame.elapsed + index * 3.2;
      material.uniforms.opacity.value = (0.24 + runtime.particleIntensity * 0.14) * auroraVisibility;
    });
    this.washMaterial.uniforms.opacity.value = (0.26 + runtime.particleIntensity * 0.06) * auroraVisibility;
  }

  dispose() {
    disposeObjectTree(this.group);
    this.auroraMaterials.length = 0;
    this.auroraCurtains.length = 0;
  }

  private createNightWash() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 0.3 },
        topCoverage: { value: topCoverage }
      },
      vertexShader: auroraWashVertexShader,
      fragmentShader: auroraWashFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 0;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.washMesh = mesh;
    this.syncNightWash();
    return material;
  }

  private createCurtains() {
    const curtains: AuroraCurtainConfig[] = [
      { xOffsetScale: -0.06, yOffsetScale: 0.43, z: -4.9, widthScale: 0.94, heightScale: 0.14, opacity: 0.34, rotationZ: -0.05 },
      { xOffsetScale: 0.08, yOffsetScale: 0.39, z: -5.2, widthScale: 0.86, heightScale: 0.12, opacity: 0.26, rotationZ: 0.04 }
    ];

    curtains.forEach((config, index) => {
      const material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color1: { value: new THREE.Color(0x66ffc2).convertSRGBToLinear() },
          color2: { value: new THREE.Color(0x5a4dff).convertSRGBToLinear() },
          color3: { value: new THREE.Color(0xff70bb).convertSRGBToLinear() },
          opacity: { value: config.opacity }
        },
        vertexShader: auroraVertexShader,
        fragmentShader: auroraFragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 96, 12), material);
      mesh.name = `aurora-curtain-${index + 1}`;
      mesh.rotation.z = config.rotationZ;
      mesh.renderOrder = 5 + index;
      mesh.frustumCulled = false;
      const curtain = { mesh, config };
      this.syncCurtain(curtain);
      this.auroraCurtains.push(curtain);
      this.auroraMaterials.push(material);
      this.group.add(mesh);
    });
  }

  private syncNightWash() {
    this.washViewportState = syncViewportPlane(this.washMesh, this.camera, this.washViewportState, {
      z: AURORA_WASH_Z,
      widthScale: 1.18,
      heightScale: 1.18
    });
  }

  private syncCurtains() {
    this.auroraCurtains.forEach((curtain) => this.syncCurtain(curtain));
  }

  private syncCurtain(curtain: AuroraCurtain) {
    const { config, mesh } = curtain;
    const viewport = getViewportSizeAtDepth(this.camera, config.z);
    const nextState: ViewportPlaneState = {
      aspect: this.camera.aspect,
      fov: this.camera.fov,
      cameraZ: this.camera.position.z,
      z: config.z,
      width: viewport.width,
      height: viewport.height,
      widthScale: config.widthScale,
      heightScale: config.heightScale,
      xOffsetScale: config.xOffsetScale,
      yOffsetScale: config.yOffsetScale
    };

    if (!curtain.viewportState || this.hasCurtainViewportChanged(curtain.viewportState, nextState)) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(viewport.width * config.widthScale, viewport.height * config.heightScale, 96, 12);
    }

    mesh.position.set(viewport.width * config.xOffsetScale, viewport.height * config.yOffsetScale, config.z);
    curtain.viewportState = nextState;
  }

  private hasCurtainViewportChanged(previous: ViewportPlaneState, next: ViewportPlaneState) {
    return (
      Math.abs(previous.aspect - next.aspect) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.fov - next.fov) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.cameraZ - next.cameraZ) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.z - next.z) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.widthScale - next.widthScale) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.heightScale - next.heightScale) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.xOffsetScale - next.xOffsetScale) > AURORA_VIEWPORT_EPSILON ||
      Math.abs(previous.yOffsetScale - next.yOffsetScale) > AURORA_VIEWPORT_EPSILON
    );
  }
}
