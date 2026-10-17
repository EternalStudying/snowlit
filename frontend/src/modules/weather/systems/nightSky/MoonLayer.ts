import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { getViewportSizeAtDepth } from '../shared/viewportPlane';
import { moonFragmentShader, moonGlowFragmentShader, nightSkyPlaneVertexShader } from './nightSkyShaders';
import type { NightSkyRenderProfile } from './nightSkyProfile';

const MOON_Z = -6.6;

export class MoonLayer {
  private readonly group = new THREE.Group();
  private readonly moonMaterial: THREE.ShaderMaterial;
  private readonly glowMaterial: THREE.ShaderMaterial;
  private readonly moonMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly glowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  constructor(
    parent: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: NightSkyRenderProfile
  ) {
    this.group.name = 'night-moon-system';
    this.group.renderOrder = -20;
    parent.add(this.group);

    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: profile.moonOpacity },
        moonColor: { value: new THREE.Color(profile.moonColor).convertSRGBToLinear() }
      },
      vertexShader: nightSkyPlaneVertexShader,
      fragmentShader: moonGlowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.glowMaterial);
    this.glowMesh.name = 'night-moon-glow';
    this.glowMesh.renderOrder = -21;
    this.glowMesh.frustumCulled = false;
    this.group.add(this.glowMesh);

    this.moonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: profile.moonOpacity },
        moonPhase: { value: profile.moonPhase },
        moonColor: { value: new THREE.Color(profile.moonColor).convertSRGBToLinear() }
      },
      vertexShader: nightSkyPlaneVertexShader,
      fragmentShader: moonFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    this.moonMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.moonMaterial);
    this.moonMesh.name = 'night-moon-disc';
    this.moonMesh.renderOrder = -20;
    this.moonMesh.frustumCulled = false;
    this.group.add(this.moonMesh);
    this.syncViewport();
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    this.profile = profile;
    this.moonMaterial.uniforms.opacity.value = profile.moonOpacity;
    this.moonMaterial.uniforms.moonPhase.value = profile.moonPhase;
    this.moonMaterial.uniforms.moonColor.value.set(profile.moonColor).convertSRGBToLinear();
    this.glowMaterial.uniforms.opacity.value = profile.moonOpacity;
    this.glowMaterial.uniforms.moonColor.value.set(profile.moonColor).convertSRGBToLinear();
    this.syncViewport();
  }

  update(_frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const opacity =
      this.profile.moonOpacity *
      runtime.orchestration.nightSkyVisibility *
      runtime.orchestration.moonVisibilityMultiplier;
    this.moonMaterial.uniforms.opacity.value = opacity;
    this.glowMaterial.uniforms.opacity.value = opacity;
    this.syncViewport();
  }

  dispose() {
    this.group.removeFromParent();
    this.moonMesh.geometry.dispose();
    this.glowMesh.geometry.dispose();
    this.moonMaterial.dispose();
    this.glowMaterial.dispose();
  }

  private syncViewport() {
    const viewport = getViewportSizeAtDepth(this.camera, MOON_Z);
    const moonSize = Math.min(viewport.width, viewport.height) * 0.084;
    const glowSize = moonSize * 4.4;
    const [xOffset, yOffset] = this.profile.moonPosition;
    const x = viewport.width * xOffset;
    const y = viewport.height * yOffset;

    this.group.position.set(x, y, MOON_Z);
    this.moonMesh.scale.set(moonSize, moonSize, 1);
    this.glowMesh.scale.set(glowSize, glowSize, 1);
  }
}
