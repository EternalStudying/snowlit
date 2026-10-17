import * as THREE from 'three';

export type ViewportPlaneState = {
  aspect: number;
  fov: number;
  cameraZ: number;
  z: number;
  width: number;
  height: number;
  widthScale: number;
  heightScale: number;
  xOffsetScale: number;
  yOffsetScale: number;
};

export type ViewportPlaneOptions = {
  z: number;
  widthScale: number;
  heightScale: number;
  xOffsetScale?: number;
  yOffsetScale?: number;
};

type DisposableObject = THREE.Object3D & {
  geometry?: { dispose(): void };
  material?: THREE.Material | THREE.Material[];
};

type BottomEdgePositionOptions = {
  z: number;
  count: number;
  widthScale: number;
  bottomBand: readonly [number, number];
  depthRange: number;
};

const VIEWPORT_EPSILON = 0.0001;

export function getViewportSizeAtDepth(camera: THREE.PerspectiveCamera, z: number) {
  const distance = Math.abs(camera.position.z - z);
  const height = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;

  return {
    width: height * camera.aspect,
    height
  };
}

export function syncViewportPlane(
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>,
  camera: THREE.PerspectiveCamera,
  state: ViewportPlaneState | undefined,
  options: ViewportPlaneOptions
): ViewportPlaneState {
  const viewport = getViewportSizeAtDepth(camera, options.z);
  const xOffsetScale = options.xOffsetScale ?? 0;
  const yOffsetScale = options.yOffsetScale ?? 0;
  const nextState: ViewportPlaneState = {
    aspect: camera.aspect,
    fov: camera.fov,
    cameraZ: camera.position.z,
    z: options.z,
    width: viewport.width,
    height: viewport.height,
    widthScale: options.widthScale,
    heightScale: options.heightScale,
    xOffsetScale,
    yOffsetScale
  };

  if (!state || hasViewportSignatureChanged(state, nextState)) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.PlaneGeometry(viewport.width * options.widthScale, viewport.height * options.heightScale);
  }

  mesh.position.set(viewport.width * xOffsetScale, viewport.height * yOffsetScale, options.z);

  return nextState;
}

export function fillBottomEdgePositions(
  positions: Float32Array,
  camera: THREE.PerspectiveCamera,
  options: BottomEdgePositionOptions
) {
  const viewport = getViewportSizeAtDepth(camera, options.z);
  const [bottomMin, bottomMax] = options.bottomBand;

  for (let index = 0; index < options.count; index += 1) {
    const offset = index * 3;
    const xSeed = pseudoRandom(index, 1.3);
    const ySeed = pseudoRandom(index, 7.1);
    const zSeed = pseudoRandom(index, 11.9);
    const bottomRatio = bottomMin + ySeed * (bottomMax - bottomMin);

    positions[offset] = (xSeed - 0.5) * viewport.width * options.widthScale;
    positions[offset + 1] = -viewport.height * 0.5 + viewport.height * bottomRatio;
    positions[offset + 2] = options.z - zSeed * options.depthRange;
  }
}

export function syncBottomEdgePositions(
  attribute: THREE.BufferAttribute,
  camera: THREE.PerspectiveCamera,
  state: ViewportPlaneState | undefined,
  options: BottomEdgePositionOptions
): ViewportPlaneState {
  const viewport = getViewportSizeAtDepth(camera, options.z);
  const nextState: ViewportPlaneState = {
    aspect: camera.aspect,
    fov: camera.fov,
    cameraZ: camera.position.z,
    z: options.z,
    width: viewport.width,
    height: viewport.height,
    widthScale: options.widthScale,
    heightScale: 1,
    xOffsetScale: 0,
    yOffsetScale: 0
  };

  if (!state || hasViewportSignatureChanged(state, nextState)) {
    fillBottomEdgePositions(attribute.array as Float32Array, camera, options);
    attribute.needsUpdate = true;
  }

  return nextState;
}

export function disposeObjectTree(root: THREE.Object3D) {
  root.removeFromParent();
  root.traverse((object) => {
    const disposable = object as DisposableObject;
    disposable.geometry?.dispose();

    if (Array.isArray(disposable.material)) {
      disposable.material.forEach((material) => material.dispose());
    } else {
      disposable.material?.dispose();
    }
  });
}

function hasViewportSignatureChanged(previous: ViewportPlaneState, next: ViewportPlaneState) {
  return (
    Math.abs(previous.aspect - next.aspect) > VIEWPORT_EPSILON ||
    Math.abs(previous.fov - next.fov) > VIEWPORT_EPSILON ||
    Math.abs(previous.cameraZ - next.cameraZ) > VIEWPORT_EPSILON ||
    Math.abs(previous.z - next.z) > VIEWPORT_EPSILON ||
    Math.abs(previous.widthScale - next.widthScale) > VIEWPORT_EPSILON ||
    Math.abs(previous.heightScale - next.heightScale) > VIEWPORT_EPSILON ||
    Math.abs(previous.xOffsetScale - next.xOffsetScale) > VIEWPORT_EPSILON ||
    Math.abs(previous.yOffsetScale - next.yOffsetScale) > VIEWPORT_EPSILON
  );
}

function pseudoRandom(index: number, salt: number) {
  return THREE.MathUtils.euclideanModulo(Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453123, 1);
}
