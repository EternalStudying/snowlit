import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { snowVeilFragmentShader, snowVeilVertexShader } from '../../effects/snow/snowShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

type SnowVeilSettings = {
  veilOpacity: number;
};

const SNOW_VEIL_SETTINGS: Record<string, SnowVeilSettings> = {
  lightSnow: { veilOpacity: 0.006 },
  snow: { veilOpacity: 0.018 },
  blizzard: { veilOpacity: 0.046 }
};

export class SnowVeilLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly veilMaterial: THREE.ShaderMaterial;
  private settings: SnowVeilSettings;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.settings = SNOW_VEIL_SETTINGS[profile.weatherState] ?? SNOW_VEIL_SETTINGS.snow;
    this.group.name = 'snow-veil-atmosphere-system';
    this.scene.add(this.group);
    this.veilMaterial = this.createColdAirVeil();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.settings = SNOW_VEIL_SETTINGS[profile.weatherState] ?? SNOW_VEIL_SETTINGS.snow;
    this.veilMaterial.uniforms.opacity.value = this.settings.veilOpacity;
    this.veilMaterial.uniforms.windStrength.value = profile.windMultiplier;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.veilMaterial.uniforms.time.value = frame.elapsed;
    this.veilMaterial.uniforms.opacity.value = this.settings.veilOpacity * (0.5 + runtime.snowIntensity * 0.5);
    this.veilMaterial.uniforms.windStrength.value = Math.min(runtime.windMultiplier, 3);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as DisposableMaterial | DisposableMaterial[] | undefined;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
  }

  private createColdAirVeil() {
    const veilZ = -5.7;
    const viewport = this.getViewportSizeAtDepth(veilZ);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        veilColor: { value: new THREE.Color(0xdce8f5).convertSRGBToLinear() },
        opacity: { value: this.settings.veilOpacity },
        windStrength: { value: this.profile.windMultiplier }
      },
      vertexShader: snowVeilVertexShader,
      fragmentShader: snowVeilFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(viewport.width * 1.2, viewport.height * 1.2), material);
    veil.position.set(0, 0, veilZ);
    veil.renderOrder = 1;
    veil.frustumCulled = false;
    this.group.add(veil);
    return material;
  }

  private getViewportSizeAtDepth(z: number) {
    const distance = Math.abs(this.camera.position.z - z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;

    return {
      width: height * this.camera.aspect,
      height
    };
  }
}
