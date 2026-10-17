export interface SavedRouteScrollPosition {
  left: number;
  top: number;
}

let shouldPreserveNextRouteScrollPosition = false;

export function preserveNextRouteScrollPosition(): void {
  shouldPreserveNextRouteScrollPosition = true;
}

export function consumeRouteScrollPosition(
  savedPosition: SavedRouteScrollPosition | null
): SavedRouteScrollPosition | false {
  if (savedPosition) {
    shouldPreserveNextRouteScrollPosition = false;
    return savedPosition;
  }

  if (shouldPreserveNextRouteScrollPosition) {
    shouldPreserveNextRouteScrollPosition = false;
    return false;
  }

  return { top: 0, left: 0 };
}
