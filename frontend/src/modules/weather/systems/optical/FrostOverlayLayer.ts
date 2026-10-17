import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { frostFragmentShader, frostVertexShader } from '../../effects/optical/frostShaders';
import { disposeObjectTree, syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';

const FROST_Z = -2.1;
const LIGHT_SNOW_FROST_INTENSITY = 0.08;
const SNOW_FROST_INTENSITY = 0.22;
const BLIZZARD_FROST_INTENSITY_CAP = 0.38;

export class FrostOverlayLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private overlayMesh!: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'frost-optical-system';
    this.scene.add(this.group);
    this.material = this.createOverlay();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.syncOverlay();
    const coldVariantBoost = this.profile.weatherVariant === 'cold' ? 0.1 : 0;
    const stateCap =
      this.profile.weatherState === 'blizzard'
        ? BLIZZARD_FROST_INTENSITY_CAP
        : this.profile.weatherState === 'lightSnow'
          ? LIGHT_SNOW_FROST_INTENSITY
          : SNOW_FROST_INTENSITY;
    const centerProtection = this.profile.weatherState === 'blizzard' ? 0.64 : 0.54;
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.intensity.value = Math.min(stateCap, runtime.snowIntensity * 0.32 + coldVariantBoost);
    this.material.uniforms.opacity.value = 0.42 + runtime.snowIntensity * 0.18;
    this.material.uniforms.centerProtection.value = centerProtection;
    this.material.uniforms.readabilityRadius.value = 0.42 + runtime.snowIntensity * 0.08;
  }

  dispose() {
    disposeObjectTree(this.group);
  }

  private createOverlay() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        intensity: { value: this.profile.particleIntensity * 0.22 },
        opacity: { value: 0.58 },
        centerProtection: { value: 0.56 },
        readabilityRadius: { value: 0.44 }
      },
      vertexShader: frostVertexShader,
      fragmentShader: frostFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.renderOrder = 13;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.overlayMesh = mesh;
    this.syncOverlay();
    return material;
  }

  private syncOverlay() {
    this.viewportState = syncViewportPlane(this.overlayMesh, this.camera, this.viewportState, {
      z: FROST_Z,
      widthScale: 1.1,
      heightScale: 1.1
    });
  }
}
