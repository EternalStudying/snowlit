import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { rainbowFragmentShader, rainbowVertexShader } from '../../effects/optical/rainbowShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

const UPPER_RIGHT_RAINBOW_POSITION = new THREE.Vector3(4.42, 1.78, -3.42);

export class RainbowOpticalLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    _camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'rainbow-optical-system';
    this.scene.add(this.group);
    this.material = this.createRainbow();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.opacity.value =
      Math.min(0.24, 0.11 + runtime.ambientWarmth * 0.12) * runtime.orchestration.sunnyOpticalVisibility;
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

  private createRainbow() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0.22 }
      },
      vertexShader: rainbowVertexShader,
      fragmentShader: rainbowFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const rainbow = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 14, 96, Math.PI), material);
    rainbow.name = 'upper-right-rainbow';
    rainbow.position.copy(UPPER_RIGHT_RAINBOW_POSITION);
    rainbow.rotation.z = -0.12;
    rainbow.scale.set(1.08, 0.82, 1);
    rainbow.renderOrder = 4;
    rainbow.frustumCulled = false;
    this.group.add(rainbow);
    return material;
  }
}
