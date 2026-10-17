import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { wetSurfaceFragmentShader, wetSurfaceVertexShader } from '../../effects/environment/wetSurfaceShaders';
import { disposeObjectTree, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const WET_SURFACE_Z = -2.8;

export class WetSurfaceLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private surfaceMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'wet-surface-environment-system';
    this.scene.add(this.group);
    this.material = this.createSurface();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncSurface();
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = runtime.rainIntensity;
    this.material.uniforms.opacity.value = 0.1 + runtime.rainIntensity * 0.16;
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createSurface() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity },
        opacity: { value: 0.24 }
      },
      vertexShader: wetSurfaceVertexShader,
      fragmentShader: wetSurfaceFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.surfaceMesh = mesh;
    this.syncSurface();
    return material;
  }

  private syncSurface() {
    this.viewportState = syncViewportPlane(this.surfaceMesh, this.camera, this.viewportState, {
      z: WET_SURFACE_Z,
      widthScale: 1.12,
      heightScale: 0.36,
      yOffsetScale: -0.34
    });
  }
}
