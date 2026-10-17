import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import {
  snowAccumulationFragmentShader,
  snowAccumulationVertexShader
} from '../../effects/environment/snowAccumulationShaders';
import { disposeObjectTree, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const SNOW_ACCUMULATION_Z = -2.7;

export class SnowAccumulationLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private accumulationMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'snow-accumulation-environment-system';
    this.scene.add(this.group);
    this.material = this.createAccumulation();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncAccumulation();
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = Math.min(1, runtime.snowIntensity * (this.profile.weatherState === 'blizzard' ? 1.14 : 0.86));
    this.material.uniforms.opacity.value = 0.16 + runtime.snowIntensity * 0.2;
    this.material.uniforms.centerProtection.value = this.profile.weatherState === 'blizzard' ? 0.58 : 0.66;
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createAccumulation() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        opacity: { value: 0.24 },
        centerProtection: { value: 0.64 }
      },
      vertexShader: snowAccumulationVertexShader,
      fragmentShader: snowAccumulationFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 11;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.accumulationMesh = mesh;
    this.syncAccumulation();
    return material;
  }

  private syncAccumulation() {
    this.viewportState = syncViewportPlane(this.accumulationMesh, this.camera, this.viewportState, {
      z: SNOW_ACCUMULATION_Z,
      widthScale: 1.14,
      heightScale: 0.4,
      yOffsetScale: -0.33
    });
  }
}
