import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { starfieldFragmentShader, starfieldVertexShader } from './nightSkyShaders';
import type { NightSkyRenderProfile } from './nightSkyProfile';

const STAR_RADIUS = 16;
const STAR_DEPTH_OFFSET = 10;

function seededRandom(seed: number) {
  let state = Math.max(1, Math.floor(seed) % 2147483647);

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function blackbodyColor(tempK: number) {
  const t = tempK / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }

  return new THREE.Color(
    THREE.MathUtils.clamp(r, 0, 255) / 255,
    THREE.MathUtils.clamp(g, 0, 255) / 255,
    THREE.MathUtils.clamp(b, 0, 255) / 255
  );
}

function randomStarTemp(randomValue: number) {
  if (randomValue < 0.003) return 30000 + randomValue * 5000000;
  if (randomValue < 0.01) return 10000 + randomValue * 1000000;
  if (randomValue < 0.04) return 7500 + randomValue * 60000;
  if (randomValue < 0.11) return 6000 + randomValue * 15000;
  if (randomValue < 0.23) return 5200 + randomValue * 5000;
  if (randomValue < 0.5) return 3700 + randomValue * 3000;
  return 2400 + randomValue * 2600;
}

export class StarfieldLayer {
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  constructor(parent: THREE.Object3D, private profile: NightSkyRenderProfile) {
    this.geometry = this.createGeometry(profile.starCount);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: profile.starOpacity },
        twinkleStrength: { value: profile.twinkleStrength },
        baseSizePx: { value: profile.mode === 'aurora' ? 1.18 : 1.35 },
        glowFalloff: { value: 0.28 },
        exposure: { value: profile.mode === 'aurora' ? 0.82 : 0.95 }
      },
      vertexShader: starfieldVertexShader,
      fragmentShader: starfieldFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'night-starfield-system';
    this.points.renderOrder = -22;
    this.points.frustumCulled = false;
    parent.add(this.points);
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    this.profile = profile;
    this.material.uniforms.opacity.value = profile.starOpacity;
    this.material.uniforms.twinkleStrength.value = profile.twinkleStrength;
    this.material.uniforms.baseSizePx.value = profile.mode === 'aurora' ? 1.18 : 1.35;
    this.material.uniforms.exposure.value = profile.mode === 'aurora' ? 0.82 : 0.95;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    this.material.uniforms.time.value = frame.elapsed;
    this.material.uniforms.opacity.value =
      this.profile.starOpacity *
      runtime.orchestration.nightSkyVisibility *
      runtime.orchestration.starVisibilityMultiplier;
  }

  dispose() {
    this.points.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }

  private createGeometry(count: number) {
    const random = seededRandom(314159 + count * 17);
    const positions = new Float32Array(count * 3);
    const starData = new Float32Array(count * 4);
    const twinkleSeeds = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const direction = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      );

      direction.y = Math.abs(direction.y) * 0.82 + random() * 0.16;
      direction.z = -Math.abs(direction.z) - 0.28;
      direction.normalize();

      positions[index * 3] = direction.x * STAR_RADIUS;
      positions[index * 3 + 1] = direction.y * STAR_RADIUS * 0.78;
      positions[index * 3 + 2] = direction.z * STAR_RADIUS - STAR_DEPTH_OFFSET;

      const magnitude = -0.6 + Math.pow(random(), 0.42) * 6.4;
      const color = blackbodyColor(randomStarTemp(random())).convertSRGBToLinear();
      starData[index * 4] = color.r;
      starData[index * 4 + 1] = color.g;
      starData[index * 4 + 2] = color.b;
      starData[index * 4 + 3] = magnitude;
      twinkleSeeds[index] = random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aStarData', new THREE.BufferAttribute(starData, 4));
    geometry.setAttribute('aTwinkleSeed', new THREE.BufferAttribute(twinkleSeeds, 1));
    return geometry;
  }
}
