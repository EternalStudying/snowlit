import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { wetLensFragmentShader, wetLensVertexShader } from '../../effects/optical/wetLensShaders';
import { disposeObjectTree, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const WET_LENS_Z = -2.2;

export class WetLensOverlayLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private overlayMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'wet-lens-optical-system';
    this.scene.add(this.group);
    this.material = this.createOverlay();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.material.uniforms.intensity.value = profile.particleIntensity;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncOverlay();
    const rainIntensity = Math.min(runtime.rainIntensity, 1);
    const isStorm = this.profile.weatherState === 'storm';
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = rainIntensity;
    this.material.uniforms.opacity.value = 0.1 + rainIntensity * (isStorm ? 0.18 : 0.14);
    this.material.uniforms.centerProtection.value = isStorm ? 0.68 : 0.58 + rainIntensity * 0.04;
    this.material.uniforms.readabilityRadius.value = 0.34 + rainIntensity * 0.08;
    this.material.uniforms.edgeWetness.value = 0.74 + rainIntensity * (isStorm ? 0.44 : 0.34);
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createOverlay() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        opacity: { value: 0.2 },
        centerProtection: { value: 0.58 },
        readabilityRadius: { value: 0.36 },
        edgeWetness: { value: 0.86 }
      },
      vertexShader: wetLensVertexShader,
      fragmentShader: wetLensFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.overlayMesh = mesh;
    this.syncOverlay();
    return material;
  }

  private syncOverlay() {
    this.viewportState = syncViewportPlane(this.overlayMesh, this.camera, this.viewportState, {
      z: WET_LENS_Z,
      widthScale: 1.08,
      heightScale: 1.08
    });
  }
}
