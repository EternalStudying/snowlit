import * as THREE from 'three';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystemLayer,
  WeatherVisualSignals
} from '../../core/types';

export class DustLightningLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xd7a36c,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  private readonly flashPlane: THREE.Mesh;
  private readonly flashLight = new THREE.PointLight(0xd7a36c, 0, 26);
  private nextFlashDelay = 3.2 + Math.random() * 5.6;
  private flashOpacity = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile,
    private readonly visualSignals?: WeatherVisualSignals
  ) {
    this.group.name = 'dust-lightning-electrical-system';
    this.flashPlane = this.createFlashPlane();
    this.flashLight.position.set(0, 3.8, -5.6);
    this.group.add(this.flashPlane, this.flashLight);
    this.scene.add(this.group);
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.flashMaterial.color.set(profile.weatherVariant === 'dust' ? 0xbfa58a : 0xd7a36c);
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const intensityScale = this.profile.weatherVariant === 'dust' ? 0.35 : 1;
    const dustLightningIntensity = runtime.lightningIntensity * intensityScale;
    this.nextFlashDelay -= frame.delta;

    if (this.nextFlashDelay <= 0 && dustLightningIntensity > 0.04) {
      this.flashOpacity = Math.max(this.flashOpacity, 0.035 + dustLightningIntensity * 0.16);
      this.flashLight.intensity = 0.65 + dustLightningIntensity * 3.4;
      this.nextFlashDelay = (3.4 + Math.random() * 6.8) / Math.max(dustLightningIntensity * 4.2, 0.45);
    }

    this.flashOpacity = Math.max(0, this.flashOpacity - frame.delta * 0.22);
    this.flashMaterial.opacity = this.flashOpacity;
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - frame.delta * 2.2);
    if (this.visualSignals) {
      this.visualSignals.dustFlash = Math.max(this.visualSignals.dustFlash, this.flashOpacity);
    }
  }

  dispose() {
    this.flashPlane.geometry.dispose();
    this.flashMaterial.dispose();
    this.group.remove(this.flashLight);
    this.group.removeFromParent();
  }

  private createFlashPlane() {
    const z = -5.9;
    const distance = Math.abs(this.camera.position.z - z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(height * this.camera.aspect * 1.18, height * 1.18),
      this.flashMaterial
    );
    plane.position.set(0, 0, z);
    plane.renderOrder = 9;
    plane.frustumCulled = false;
    return plane;
  }
}
