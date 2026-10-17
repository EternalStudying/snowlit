import * as THREE from 'three';
import type { WeatherFrameState } from '../../core/types';
import { getViewportSizeAtDepth } from '../shared/viewportPlane';
import { fogSpriteFragmentShader, fogSpriteVertexShader } from './fogSpriteShaders';

export type FogSpriteSettings = {
  count: number;
  fogElementRatio: number;
  alphaMin: number;
  alphaMax: number;
  scaleMin: number;
  scaleMax: number;
  moveSpeed: number;
  centerProtection: number;
  readabilityRadius: number;
  color: number;
};

type FogSpriteLayerOptions = {
  name: string;
  textureUrl: string;
  count: number;
  seed: number;
  z: number;
  renderOrder: number;
  settings: FogSpriteSettings;
};

export class FogSpriteLayer {
  private readonly texture: THREE.Texture;
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private settings: FogSpriteSettings;

  constructor(
    private readonly parent: THREE.Group,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly options: FogSpriteLayerOptions
  ) {
    this.settings = options.settings;
    this.texture = new THREE.TextureLoader().load(options.textureUrl, undefined, undefined, () => undefined);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        fogMap: { value: this.texture },
        time: { value: 0 },
        viewportSize: { value: new THREE.Vector2() },
        windOffset: { value: new THREE.Vector2() },
        globalOpacity: { value: 0 },
        fogTint: { value: new THREE.Color(this.settings.color).convertSRGBToLinear() },
        centerProtection: { value: this.settings.centerProtection },
        readabilityRadius: { value: this.settings.readabilityRadius }
      },
      vertexShader: fogSpriteVertexShader,
      fragmentShader: fogSpriteFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.createGeometry(options.count), this.material);
    this.mesh.name = options.name;
    this.mesh.position.z = options.z;
    this.mesh.renderOrder = options.renderOrder;
    this.mesh.frustumCulled = false;
    this.syncViewportUniform();
    this.parent.add(this.mesh);
  }

  setSettings(settings: FogSpriteSettings, count: number) {
    this.settings = settings;
    this.material.uniforms.fogTint.value.set(settings.color).convertSRGBToLinear();
    this.material.uniforms.centerProtection.value = settings.centerProtection;
    this.material.uniforms.readabilityRadius.value = settings.readabilityRadius;

    if (this.mesh.geometry.instanceCount !== count) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = this.createGeometry(count);
    }
  }

  update(frame: WeatherFrameState, windOffset: THREE.Vector2, globalOpacity: number) {
    this.syncViewportUniform();
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.windOffset.value.copy(windOffset);
    this.material.uniforms.globalOpacity.value = globalOpacity;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }

  private syncViewportUniform() {
    const viewport = getViewportSizeAtDepth(this.camera, this.options.z);

    this.material.uniforms.viewportSize.value.set(viewport.width, viewport.height);
  }

  private createGeometry(count: number) {
    const baseGeometry = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    const index = baseGeometry.getIndex();

    if (index) {
      geometry.setIndex(index.clone());
    }

    geometry.setAttribute('position', baseGeometry.getAttribute('position').clone());
    geometry.setAttribute('uv', baseGeometry.getAttribute('uv').clone());
    baseGeometry.dispose();

    const origins = new Float32Array(count * 2);
    const scales = new Float32Array(count);
    const alphas = new Float32Array(count);
    const drifts = new Float32Array(count * 4);
    const phases = new Float32Array(count * 2);

    for (let index = 0; index < count; index += 1) {
      const originOffset = index * 2;
      const driftOffset = index * 4;

      origins[originOffset] = randomRange(index, this.options.seed + 1.3, -1.1, 1.1);
      origins[originOffset + 1] = randomRange(index, this.options.seed + 2.7, -1.1, 1.1);
      scales[index] = randomRange(index, this.options.seed + 4.1, this.settings.scaleMin, this.settings.scaleMax);
      alphas[index] = randomRange(index, this.options.seed + 5.9, this.settings.alphaMin, this.settings.alphaMax);
      drifts[driftOffset] = randomRange(index, this.options.seed + 7.2, 0.08, 0.26);
      drifts[driftOffset + 1] = randomRange(index, this.options.seed + 8.6, 0.08, 0.26);
      drifts[driftOffset + 2] = this.settings.moveSpeed * randomRange(index, this.options.seed + 9.8, 0.7, 1.3);
      drifts[driftOffset + 3] = this.settings.moveSpeed * randomRange(index, this.options.seed + 11.4, 0.7, 1.3);
      phases[originOffset] = randomRange(index, this.options.seed + 13.1, 0, Math.PI * 2);
      phases[originOffset + 1] = randomRange(index, this.options.seed + 14.8, 0, Math.PI * 2);
    }

    geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origins, 2));
    geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geometry.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(alphas, 1));
    geometry.setAttribute('aDrift', new THREE.InstancedBufferAttribute(drifts, 4));
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 2));
    geometry.instanceCount = count;

    return geometry;
  }
}

function randomRange(index: number, salt: number, min: number, max: number) {
  return min + pseudoRandom(index, salt) * (max - min);
}

function pseudoRandom(index: number, salt: number) {
  return THREE.MathUtils.euclideanModulo(Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123, 1);
}
