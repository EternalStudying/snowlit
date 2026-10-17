import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { syncViewportPlane, type ViewportPlaneState } from '../shared/viewportPlane';
import { nightSkyDomeFragmentShader, nightSkyPlaneVertexShader } from './nightSkyShaders';
import type { NightSkyRenderProfile } from './nightSkyProfile';

const SKY_DOME_Z = -8.4;

export class SkyDomeLayer {
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private viewportState: ViewportPlaneState | undefined;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: NightSkyRenderProfile
  ) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: profile.skyOpacity },
        horizonGlow: { value: profile.horizonGlow },
        centerProtection: { value: profile.centerProtection },
        zenithColor: { value: new THREE.Color(profile.zenithColor).convertSRGBToLinear() },
        midColor: { value: new THREE.Color(profile.midColor).convertSRGBToLinear() },
        horizonColor: { value: new THREE.Color(profile.horizonColor).convertSRGBToLinear() }
      },
      vertexShader: nightSkyPlaneVertexShader,
      fragmentShader: nightSkyDomeFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = 'night-sky-dome';
    this.mesh.renderOrder = -30;
    this.mesh.frustumCulled = false;
    this.parent.add(this.mesh);
    this.syncViewport();
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    this.profile = profile;
    this.material.uniforms.opacity.value = profile.skyOpacity;
    this.material.uniforms.horizonGlow.value = profile.horizonGlow;
    this.material.uniforms.centerProtection.value = profile.centerProtection;
    this.material.uniforms.zenithColor.value.set(profile.zenithColor).convertSRGBToLinear();
    this.material.uniforms.midColor.value.set(profile.midColor).convertSRGBToLinear();
    this.material.uniforms.horizonColor.value.set(profile.horizonColor).convertSRGBToLinear();
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.opacity.value = this.profile.skyOpacity * runtime.orchestration.nightSkyVisibility;
    this.material.uniforms.horizonGlow.value = this.profile.horizonGlow * runtime.orchestration.nightSkyVisibility;
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
      z: SKY_DOME_Z,
      widthScale: 1.18,
      heightScale: 1.18
    });
  }
}
