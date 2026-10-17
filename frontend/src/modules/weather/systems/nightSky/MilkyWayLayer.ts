import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';
import { milkyWayFragmentShader, nightSkyPlaneVertexShader } from './nightSkyShaders';
import type { NightSkyRenderProfile } from './nightSkyProfile';

const MILKY_WAY_Z = -8.1;

export class MilkyWayLayer {
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    parent: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: NightSkyRenderProfile
  ) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: profile.milkyWayOpacity },
        bandWidth: { value: profile.mode === 'aurora' ? 0.1 : 0.13 },
        bandTilt: { value: profile.mode === 'aurora' ? -0.38 : -0.48 },
        dustLanes: { value: profile.mode === 'aurora' ? 0.28 : 0.46 },
        centerProtection: { value: profile.centerProtection }
      },
      vertexShader: nightSkyPlaneVertexShader,
      fragmentShader: milkyWayFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = 'night-milky-way-system';
    this.mesh.renderOrder = -24;
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.syncViewport();
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    this.profile = profile;
    this.material.uniforms.opacity.value = profile.milkyWayOpacity;
    this.material.uniforms.bandWidth.value = profile.mode === 'aurora' ? 0.1 : 0.13;
    this.material.uniforms.bandTilt.value = profile.mode === 'aurora' ? -0.38 : -0.48;
    this.material.uniforms.dustLanes.value = profile.mode === 'aurora' ? 0.28 : 0.46;
    this.material.uniforms.centerProtection.value = profile.centerProtection;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.opacity.value =
      this.profile.milkyWayOpacity *
      runtime.orchestration.nightSkyVisibility *
      runtime.orchestration.milkyWayVisibilityMultiplier;
    this.material.uniforms.centerProtection.value = Math.max(
      this.profile.centerProtection,
      runtime.orchestration.centerProtection
    );
    this.syncViewport();
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private syncViewport() {
    this.viewportState = syncViewportPlane(this.mesh, this.camera, this.viewportState, {
      z: MILKY_WAY_Z,
      widthScale: 1.24,
      heightScale: 0.72,
      yOffsetScale: 0.16
    });
  }
}
