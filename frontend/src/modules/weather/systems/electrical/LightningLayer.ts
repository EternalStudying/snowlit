import * as THREE from 'three';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystemLayer,
  WeatherVisualSignals
} from '../../core/types';
import { WEATHER_LIGHTNING_BUDGET } from '../../core/weatherPerformanceBudget';

type LightningBolt = {
  group: THREE.Group;
  coreMaterial: THREE.LineBasicMaterial;
  glowMaterial: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
};

type DisposableObject = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

const FLASH_PLANE_Z = -6.4;
const BOLT_Z = -5.8;
const INITIAL_STRIKE_DELAY_MIN = 0.25;
const INITIAL_STRIKE_DELAY_SPREAD = 0.45;
const BURST_STRIKE_DELAY_MIN = 0.08;
const BURST_STRIKE_DELAY_SPREAD = 0.16;
const STORM_REST_DELAY_MIN = 2.4;
const STORM_REST_DELAY_SPREAD = 3.8;

export class LightningLayer implements WeatherSystemLayer {
  private readonly group = new THREE.Group();
  private readonly flashLight = new THREE.PointLight(0xdce7ff, 0, 32);
  private readonly flashPlaneMaterial = new THREE.MeshBasicMaterial({
    color: 0xb8c9ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  private readonly flashPlane: THREE.Mesh;
  private readonly bolts: LightningBolt[] = [];
  private nextStrikeDelay = INITIAL_STRIKE_DELAY_MIN + Math.random() * INITIAL_STRIKE_DELAY_SPREAD;
  private burstRemaining = 0;
  private flashOpacity = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private profile: WeatherProfile,
    private readonly visualSignals?: WeatherVisualSignals
  ) {
    this.group.name = 'storm-lightning-system';
    this.flashPlane = this.createFlashPlane();
    this.flashLight.position.set(0, 4.8, BOLT_Z);
    this.group.add(this.flashPlane);
    this.group.add(this.flashLight);
    this.scene.add(this.group);
  }

  generateBolt(start: THREE.Vector3, end: THREE.Vector3, generations = 5, jitter = 0.42): THREE.Vector3[] {
    if (generations <= 0) {
      return [start.clone(), end.clone()];
    }

    const midpoint = start.clone().lerp(end, 0.42 + Math.random() * 0.16);
    midpoint.x += (Math.random() - 0.5) * jitter;
    midpoint.y += (Math.random() - 0.5) * jitter * 0.34;
    midpoint.z += (Math.random() - 0.5) * jitter * 0.22;

    const left = this.generateBolt(start, midpoint, generations - 1, jitter * 0.68);
    const right = this.generateBolt(midpoint, end, generations - 1, jitter * 0.68);

    return [...left, ...right.slice(1)];
  }

  setProfile(profile: WeatherProfile) {
    this.profile = profile;
  }

  update(frame: WeatherFrameState, runtime: WeatherRuntimeState) {
    const stormIntensity = runtime.lightningIntensity;
    this.nextStrikeDelay -= frame.delta;

    if (this.nextStrikeDelay <= 0 && stormIntensity > 0.3) {
      if (this.burstRemaining <= 0) {
        this.burstRemaining = 2 + Math.floor(Math.random() * 2);
      }

      this.strike(stormIntensity);
      this.burstRemaining -= 1;
      this.nextStrikeDelay =
        this.burstRemaining > 0
          ? BURST_STRIKE_DELAY_MIN + Math.random() * BURST_STRIKE_DELAY_SPREAD
          : (STORM_REST_DELAY_MIN + Math.random() * STORM_REST_DELAY_SPREAD) / Math.max(stormIntensity, 0.35);
    }

    this.updateBolts(frame.delta);
    this.flashOpacity = Math.max(0, this.flashOpacity - frame.delta * 0.46);
    this.flashPlaneMaterial.opacity = this.flashOpacity;
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - frame.delta * 16);
    if (this.visualSignals) {
      this.visualSignals.stormFlash = Math.max(this.visualSignals.stormFlash, this.flashOpacity);
    }
  }

  dispose() {
    this.bolts.slice().forEach((bolt) => this.disposeBolt(bolt));
    this.flashPlane.geometry.dispose();
    this.flashPlaneMaterial.dispose();
    this.group.remove(this.flashLight);
    this.group.removeFromParent();
  }

  private strike(stormIntensity: number) {
    const side = Math.random() > 0.44 ? 1 : -1;
    const start = new THREE.Vector3(side * (1.2 + Math.random() * 3.1), 5.4 + Math.random() * 0.9, BOLT_Z);
    const end = new THREE.Vector3(
      start.x + (Math.random() - 0.5) * 1.9,
      -1.2 - Math.random() * 2.2,
      BOLT_Z + (Math.random() - 0.5) * 0.32
    );
    const points = this.generateBolt(start, end, 5, 0.72);
    const segments = this.createBoltSegments(points);
    const bolt = this.createBoltMesh(segments, 0.16 + Math.random() * 0.17);

    this.group.add(bolt.group);
    this.bolts.push(bolt);
    while (this.bolts.length > WEATHER_LIGHTNING_BUDGET.maxActiveBolts) {
      const staleBolt = this.bolts.shift();

      if (staleBolt) {
        this.disposeBolt(staleBolt);
      }
    }
    this.flashLight.position.copy(start);
    this.flashLight.intensity = 4.8 * stormIntensity;
    this.flashOpacity = Math.max(this.flashOpacity, 0.08 + stormIntensity * 0.055);
  }

  private createBoltSegments(points: THREE.Vector3[]) {
    const segments: THREE.Vector3[] = [];
    this.appendPathSegments(segments, points);

    for (let index = 2; index < points.length - 2; index += 4) {
      if (Math.random() > 0.36) {
        continue;
      }

      const source = points[index];
      const branchEnd = source.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 1.5, -0.7 - Math.random() * 1.2, (Math.random() - 0.5) * 0.3)
      );
      const branch = this.generateBolt(source, branchEnd, 2, 0.34);
      this.appendPathSegments(segments, branch);
    }

    return segments;
  }

  private appendPathSegments(target: THREE.Vector3[], points: THREE.Vector3[]) {
    for (let index = 0; index < points.length - 1; index += 1) {
      target.push(points[index], points[index + 1]);
    }
  }

  private createBoltMesh(segments: THREE.Vector3[], maxLife: number): LightningBolt {
    const positions = new Float32Array(segments.length * 3);
    segments.forEach((point, index) => {
      positions[index * 3] = point.x;
      positions[index * 3 + 1] = point.y;
      positions[index * 3 + 2] = point.z;
    });

    const coreGeometry = new THREE.BufferGeometry();
    coreGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const glowGeometry = coreGeometry.clone();
    const coreMaterial = new THREE.LineBasicMaterial({
      color: 0xf9fbff,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const glowMaterial = new THREE.LineBasicMaterial({
      color: 0x8fb2ff,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const core = new THREE.LineSegments(coreGeometry, coreMaterial);
    const glow = new THREE.LineSegments(glowGeometry, glowMaterial);
    const group = new THREE.Group();

    glow.scale.setScalar(1.018);
    core.renderOrder = 7;
    glow.renderOrder = 6;
    core.frustumCulled = false;
    glow.frustumCulled = false;
    group.add(glow, core);

    return {
      group,
      coreMaterial,
      glowMaterial,
      life: maxLife,
      maxLife
    };
  }

  private createFlashPlane() {
    const distance = Math.abs(this.camera.position.z - FLASH_PLANE_Z);
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * distance;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(height * this.camera.aspect * 1.35, height * 1.35),
      this.flashPlaneMaterial
    );

    plane.position.set(0, 0, FLASH_PLANE_Z);
    plane.renderOrder = 5;
    plane.frustumCulled = false;
    return plane;
  }

  private updateBolts(delta: number) {
    for (let index = this.bolts.length - 1; index >= 0; index -= 1) {
      const bolt = this.bolts[index];
      bolt.life -= delta;
      const alpha = Math.max(bolt.life / bolt.maxLife, 0);
      bolt.coreMaterial.opacity = alpha * 0.88;
      bolt.glowMaterial.opacity = alpha * 0.26;

      if (bolt.life <= 0) {
        this.disposeBolt(bolt);
        this.bolts.splice(index, 1);
      }
    }
  }

  private disposeBolt(bolt: LightningBolt) {
    this.group.remove(bolt.group);
    bolt.group.traverse((object) => {
      const disposable = object as DisposableObject;
      disposable.geometry?.dispose();
      const material = disposable.material;

      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else if (material) {
        material.dispose();
      }
    });
  }
}
