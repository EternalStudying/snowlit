export function warnWeatherLayerLoadFailure(owner: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.warn(`${owner} weather layer failed to load`, error);
  }
}
