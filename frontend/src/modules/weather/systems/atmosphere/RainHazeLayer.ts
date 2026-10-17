import * as THREE from 'three';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState, WeatherSystemLayer } from '../../core/types';
import { rainHazeFragmentShader, rainHazeVertexShader } from '../../effects/rain/rainShaders';

type DisposableMaterial = THREE.Material & {
  uniforms?: Record<string, { value: unknown }>;
};

export class RainHazeLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly hazeMaterial: THREE.ShaderMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile
  ) {
    this.group.name = 'rain-haze-atmosphere-system';
    this.scene.add(this.group);
    this.hazeMaterial = this.createMoistAirHaze();
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
    this.hazeMaterial.uniforms.opacity.value = 0.058 + profile.particleIntensity * 0.052;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.hazeMaterial.uniforms.time.value = frame.elapsed;
    this.hazeMaterial.uniforms.opacity.value = 0.058 + runtime.rainIntensity * 0.052;
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

  private createMoistAirHaze() {
    const hazeZ = -4.8;
    const viewport = this.getViewportSizeAtDepth(hazeZ);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        hazeColor: { value: new THREE.Color(0x6f8092).convertSRGBToLinear() },
        opacity: { value: 0.095 }
      },
      vertexShader: rainHazeVertexShader,
      fragmentShader: rainHazeFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(viewport.width * 1.16, viewport.height * 1.16), material);
    haze.position.set(0, 0, hazeZ);
    haze.renderOrder = 1;
    haze.frustumCulled = false;
    this.group.add(haze);
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
