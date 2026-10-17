import * as THREE from 'three';
import type { WeatherFrameState, WeatherRuntimeState } from '../../core/types';
import { WEATHER_METEOR_BUDGET } from '../../core/weatherPerformanceBudget';
import { getViewportSizeAtDepth } from '../shared/viewportPlane';
import {
  meteorHeadFragmentShader,
  meteorHeadVertexShader,
  meteorTrailFragmentShader,
  meteorTrailVertexShader
} from './meteorShaders';
import type { NightSkyRenderProfile } from './nightSkyProfile';

const METEOR_Z = -7.15;
const HEAD_BASE_SIZE = 9;

type MeteorSlot = {
  active: boolean;
  life: number;
  duration: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  trailLength: number;
  size: number;
};

function createEmptySlot(): MeteorSlot {
  return {
    active: false,
    life: 0,
    duration: 1,
    startX: 0,
    startY: 0,
    velocityX: 0,
    velocityY: 0,
    trailLength: 1,
    size: HEAD_BASE_SIZE
  };
}

function disposeGeometry(geometry: THREE.BufferGeometry) {
  geometry.dispose();
}

function disposeMaterial(material: THREE.Material) {
  material.dispose();
}

export class MeteorLayer {
  private readonly group = new THREE.Group();
  private readonly maxActive = WEATHER_METEOR_BUDGET.maxActiveMeteors;
  private readonly slots: MeteorSlot[] = Array.from({ length: this.maxActive }, createEmptySlot);
  private readonly trailPositions = new Float32Array(this.maxActive * 2 * 3);
  private readonly trailAlpha = new Float32Array(this.maxActive * 2);
  private readonly headPositions = new Float32Array(this.maxActive * 3);
  private readonly headAlpha = new Float32Array(this.maxActive);
  private readonly headSize = new Float32Array(this.maxActive);
  private readonly trailGeometry = new THREE.BufferGeometry();
  private readonly headGeometry = new THREE.BufferGeometry();
  private readonly trailMaterial: THREE.ShaderMaterial;
  private readonly headMaterial: THREE.ShaderMaterial;
  private readonly trailMesh: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly headMesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private spawnAccumulator = 0;
  private seed = 97531;

  constructor(
    parent: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: NightSkyRenderProfile
  ) {
    this.group.name = 'night-meteor-system';
    this.group.renderOrder = -18;
    parent.add(this.group);

    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.trailAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.headGeometry.setAttribute('position', new THREE.BufferAttribute(this.headPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.headGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.headAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.headGeometry.setAttribute('aSize', new THREE.BufferAttribute(this.headSize, 1).setUsage(THREE.DynamicDrawUsage));

    this.trailMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tint: { value: new THREE.Color(profile.meteorTint).convertSRGBToLinear() },
        opacity: { value: profile.meteorOpacity }
      },
      vertexShader: meteorTrailVertexShader,
      fragmentShader: meteorTrailFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    this.trailMesh = new THREE.LineSegments(this.trailGeometry, this.trailMaterial);
    this.trailMesh.name = 'night-meteor-trail-pool';
    this.trailMesh.renderOrder = -18;
    this.trailMesh.frustumCulled = false;
    this.group.add(this.trailMesh);

    this.headMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tint: { value: new THREE.Color(profile.meteorTint).convertSRGBToLinear() },
        opacity: { value: profile.meteorOpacity }
      },
      vertexShader: meteorHeadVertexShader,
      fragmentShader: meteorHeadFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    this.headMesh = new THREE.Points(this.headGeometry, this.headMaterial);
    this.headMesh.name = 'night-meteor-head-pool';
    this.headMesh.renderOrder = -17;
    this.headMesh.frustumCulled = false;
    this.group.add(this.headMesh);

    this.clearBuffers();
    this.spawnAccumulator = profile.meteorShower ? 1 : 0;
  }

  setRenderProfile(profile: NightSkyRenderProfile) {
    this.profile = profile;
    this.trailMaterial.uniforms.tint.value.set(profile.meteorTint).convertSRGBToLinear();
    this.trailMaterial.uniforms.opacity.value = profile.meteorOpacity;
    this.headMaterial.uniforms.tint.value.set(profile.meteorTint).convertSRGBToLinear();
    this.headMaterial.uniforms.opacity.value = profile.meteorOpacity;

    for (let index = profile.meteorMaxActive; index < this.maxActive; index += 1) {
      this.deactivateSlot(index);
    }

    if (profile.meteorShower && !this.hasActiveMeteor()) {
      this.spawnAccumulator = Math.max(this.spawnAccumulator, 1);
    }
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const visibility =
      runtime.orchestration.nightSkyVisibility * runtime.orchestration.meteorVisibilityMultiplier;
    this.trailMaterial.uniforms.opacity.value = this.profile.meteorOpacity * visibility;
    this.headMaterial.uniforms.opacity.value = this.profile.meteorOpacity * visibility;

    if (this.profile.meteorRate > 0 && this.profile.meteorMaxActive > 0 && visibility > 0.05) {
      this.spawnAccumulator += frame.delta * this.profile.meteorRate * visibility;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawnMeteor();
      }
    }

    for (let index = 0; index < this.maxActive; index += 1) {
      const slot = this.slots[index];
      if (!slot.active) {
        this.writeInactiveSlot(index);
        continue;
      }

      slot.life += frame.delta;
      if (slot.life >= slot.duration) {
        this.deactivateSlot(index);
        continue;
      }

      this.writeActiveSlot(index, slot);
    }

    this.markBuffersDirty();
  }

  dispose() {
    this.group.removeFromParent();
    disposeGeometry(this.trailGeometry);
    disposeGeometry(this.headGeometry);
    disposeMaterial(this.trailMaterial);
    disposeMaterial(this.headMaterial);
  }

  private spawnMeteor() {
    const slotIndex = this.slots.findIndex((slot, index) => !slot.active && index < this.profile.meteorMaxActive);

    if (slotIndex < 0) {
      return;
    }

    const viewport = getViewportSizeAtDepth(this.camera, METEOR_Z);
    const randomA = this.nextRandom();
    const randomB = this.nextRandom();
    const randomC = this.nextRandom();
    const randomD = this.nextRandom();
    const slot = this.slots[slotIndex];

    slot.active = true;
    slot.life = 0;
    slot.duration = this.profile.meteorShower ? 0.72 + randomA * 0.28 : 0.86 + randomA * 0.34;
    slot.startX = viewport.width * (-0.46 + randomB * 0.78);
    slot.startY = viewport.height * (0.24 + randomC * 0.24);
    slot.velocityX = viewport.width * (0.18 + randomD * 0.12);
    slot.velocityY = -viewport.height * (0.14 + this.nextRandom() * 0.09);
    slot.trailLength = Math.min(viewport.width, viewport.height) * (0.13 + this.nextRandom() * 0.06);
    slot.size = HEAD_BASE_SIZE + this.nextRandom() * 5;
    this.writeActiveSlot(slotIndex, slot);
  }

  private writeActiveSlot(index: number, slot: MeteorSlot) {
    const progress = THREE.MathUtils.clamp(slot.life / slot.duration, 0, 1);
    const flare = Math.sin(progress * Math.PI);
    const headX = slot.startX + slot.velocityX * progress;
    const headY = slot.startY + slot.velocityY * progress;
    const velocityLength = Math.max(Math.hypot(slot.velocityX, slot.velocityY), 0.001);
    const trailX = (slot.velocityX / velocityLength) * slot.trailLength * (0.72 + progress * 0.18);
    const trailY = (slot.velocityY / velocityLength) * slot.trailLength * (0.72 + progress * 0.18);
    const positionIndex = index * 6;
    const alphaIndex = index * 2;
    const headIndex = index * 3;

    this.trailPositions[positionIndex] = headX - trailX;
    this.trailPositions[positionIndex + 1] = headY - trailY;
    this.trailPositions[positionIndex + 2] = METEOR_Z;
    this.trailPositions[positionIndex + 3] = headX;
    this.trailPositions[positionIndex + 4] = headY;
    this.trailPositions[positionIndex + 5] = METEOR_Z;
    this.trailAlpha[alphaIndex] = 0;
    this.trailAlpha[alphaIndex + 1] = flare;

    this.headPositions[headIndex] = headX;
    this.headPositions[headIndex + 1] = headY;
    this.headPositions[headIndex + 2] = METEOR_Z;
    this.headAlpha[index] = flare;
    this.headSize[index] = slot.size;
  }

  private deactivateSlot(index: number) {
    this.slots[index].active = false;
    this.slots[index].life = 0;
    this.writeInactiveSlot(index);
  }

  private writeInactiveSlot(index: number) {
    const positionIndex = index * 6;
    const alphaIndex = index * 2;
    const headIndex = index * 3;

    this.trailPositions[positionIndex] = 0;
    this.trailPositions[positionIndex + 1] = 0;
    this.trailPositions[positionIndex + 2] = METEOR_Z;
    this.trailPositions[positionIndex + 3] = 0;
    this.trailPositions[positionIndex + 4] = 0;
    this.trailPositions[positionIndex + 5] = METEOR_Z;
    this.trailAlpha[alphaIndex] = 0;
    this.trailAlpha[alphaIndex + 1] = 0;
    this.headPositions[headIndex] = 0;
    this.headPositions[headIndex + 1] = 0;
    this.headPositions[headIndex + 2] = METEOR_Z;
    this.headAlpha[index] = 0;
    this.headSize[index] = 0;
  }

  private clearBuffers() {
    for (let index = 0; index < this.maxActive; index += 1) {
      this.writeInactiveSlot(index);
    }
    this.markBuffersDirty();
  }

  private hasActiveMeteor() {
    return this.slots.some((slot) => slot.active);
  }

  private markBuffersDirty() {
    this.trailGeometry.getAttribute('position').needsUpdate = true;
    this.trailGeometry.getAttribute('aAlpha').needsUpdate = true;
    this.headGeometry.getAttribute('position').needsUpdate = true;
    this.headGeometry.getAttribute('aAlpha').needsUpdate = true;
    this.headGeometry.getAttribute('aSize').needsUpdate = true;
  }

  private nextRandom() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}
