import * as THREE from 'three';

export class WindSystem {
  direction = new THREE.Vector3(0.55, 0, 0.18).normalize();
  baseSpeed = 0.18;
  gustSpeed = 0;
  turbulence = 0.025;

  private elapsed = 0;

  update(delta: number) {
    this.elapsed += delta;
    const gustEnvelope = Math.sin(this.elapsed * 0.34) * 0.5 + 0.5;
    this.gustSpeed = gustEnvelope * this.baseSpeed * 0.58;
  }

  get speed() {
    return this.baseSpeed + this.gustSpeed;
  }

  get force() {
    const turbulence = new THREE.Vector3(
      Math.sin(this.elapsed * 0.73) * this.turbulence,
      Math.sin(this.elapsed * 0.41) * this.turbulence * 0.5,
      Math.cos(this.elapsed * 0.61) * this.turbulence
    );

    return this.direction.clone().multiplyScalar(this.speed).add(turbulence);
  }
}
