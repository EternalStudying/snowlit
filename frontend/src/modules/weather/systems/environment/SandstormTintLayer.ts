import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import {
  sandstormTintFragmentShader,
  sandstormTintVertexShader
} from '../../effects/environment/sandstormTintShaders';
import { disposeObjectTree, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const SANDSTORM_TINT_Z = -6.15;

export class SandstormTintLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private tintMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'sandstorm-tint-environment-system';
    this.scene.add(this.group);
    this.material = this.createTint();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    const tint = profile.weatherVariant === 'dust' ? 0xd2bd7c : 0xc18442;
    this.material.uniforms.tintColor.value.copy(new THREE.Color(tint).convertSRGBToLinear());
    this.material.uniforms.centerProtection.value = profile.weatherVariant === 'dust' ? 0.64 : 0.58;
    this.material.uniforms.readabilityRadius.value = profile.weatherVariant === 'dust' ? 0.3 : 0.34;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncTint();
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = runtime.particleIntensity;
    this.material.uniforms.opacity.value = this.profile.weatherVariant === 'dust' ? 0.1 : 0.2;
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createTint() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        tintColor: { value: new THREE.Color(0xc18442).convertSRGBToLinear() },
        intensity: { value: this.profile.particleIntensity },
        opacity: { value: 0.22 },
        centerProtection: { value: 0.58 },
        readabilityRadius: { value: 0.34 }
      },
      vertexShader: sandstormTintVertexShader,
      fragmentShader: sandstormTintFragmentShader,
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
    this.tintMesh = mesh;
    this.syncTint();
    return material;
  }

  private syncTint() {
    this.viewportState = syncViewportPlane(this.tintMesh, this.camera, this.viewportState, {
      z: SANDSTORM_TINT_Z,
      widthScale: 1.2,
      heightScale: 1.2
    });
  }
}
