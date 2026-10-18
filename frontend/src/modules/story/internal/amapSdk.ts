export type AMapCoordinateTuple = [number, number];

export interface AMapLngLat {
  getLng?: () => number;
  getLat?: () => number;
  lng?: number;
  lat?: number;
  longitude?: number;
  latitude?: number;
}

export interface AMapPixelPoint {
  getX?: () => number;
  getY?: () => number;
  x?: number;
  y?: number;
}

export interface AMapMouseEvent {
  lnglat?: AMapLngLat;
  pixel?: AMapPixelPoint;
  originEvent?: MouseEvent;
}

export interface AMapMarkerInstance {
  setMap(map: AMapMapInstance | null): void;
}

export interface AMapMapInstance {
  destroy(): void;
  on(event: 'click' | 'rightclick', handler: (event: AMapMouseEvent) => void): void;
  setFitView(
    markers: AMapMarkerInstance[],
    immediately?: boolean,
    avoid?: [number, number, number, number],
    maxZoom?: number
  ): void;
  setZoomAndCenter(
    zoom: number,
    center: AMapCoordinateTuple,
    immediately?: boolean,
    duration?: number
  ): void;
  setZoom(zoom: number, immediately?: boolean, duration?: number): void;
  setPitch(pitch: number, immediately?: boolean, duration?: number): void;
  setRotation(rotation: number, immediately?: boolean, duration?: number): void;
  getZoom(precision?: number): number;
  getZooms(): [number, number];
  getCenter(): AMapLngLat;
}

interface AMapMapOptions {
  center: AMapCoordinateTuple;
  zoom: number;
  resizeEnable: boolean;
  viewMode: '3D';
  pitch: number;
  rotation: number;
  animateEnable: boolean;
  jogEnable: boolean;
  scrollWheel: boolean;
  mapStyle: string;
}

interface AMapMarkerOptions {
  position: AMapCoordinateTuple;
  offset: AMapPixelPoint;
  content: HTMLElement;
}

interface AMapGeocoderResult {
  regeocode?: {
    formattedAddress?: unknown;
    pois?: Array<{
      name?: unknown;
    }>;
  };
}

interface AMapGeocoderInstance {
  getAddress(
    coordinate: AMapCoordinateTuple,
    callback: (status: string, result: AMapGeocoderResult) => void
  ): void;
}

interface AMapAutocompleteResult {
  tips?: unknown[];
}

interface AMapAutocompleteInstance {
  search(
    keyword: string,
    callback: (status: string, result: AMapAutocompleteResult) => void
  ): void;
}

export interface AMapSdk {
  Map: new (element: HTMLElement, options: AMapMapOptions) => AMapMapInstance;
  Marker?: new (options: AMapMarkerOptions) => AMapMarkerInstance;
  Pixel?: new (x: number, y: number) => AMapPixelPoint;
  Geocoder?: new () => AMapGeocoderInstance;
  AutoComplete?: new (options: { datatype: 'poi' }) => AMapAutocompleteInstance;
  plugin?: (plugins: string[], callback: () => void) => void;
}

export interface AMapLocationSuggestion {
  id: string;
  name: string;
  address: string;
  longitude: number;
  latitude: number;
}

declare global {
  interface Window {
    AMap?: AMapSdk;
    _AMapSecurityConfig?: {
      securityJsCode?: string;
    };
  }
}

let sdkLoader: Promise<AMapSdk> | null = null;
let autocompleteService: AMapAutocompleteInstance | null = null;
let autocompleteLoader: Promise<AMapAutocompleteInstance> | null = null;

export function getLoadedAmapSdk(): AMapSdk | undefined {
  return window.AMap;
}

export function loadAmapSdk(): Promise<AMapSdk> {
  const loadedSdk = getLoadedAmapSdk();
  if (loadedSdk?.Map) {
    return Promise.resolve(loadedSdk);
  }
  if (sdkLoader) {
    return sdkLoader;
  }

  const key = import.meta.env.VITE_AMAP_KEY?.trim();
  if (!key) {
    return Promise.reject(new Error('未配置 VITE_AMAP_KEY，当前显示地图占位'));
  }

  const securityCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE?.trim();
  if (securityCode) {
    window._AMapSecurityConfig = { securityJsCode: securityCode };
  }

  sdkLoader = new Promise((resolve, reject) => {
    const resolveLoadedSdk = () => {
      const sdk = getLoadedAmapSdk();
      if (sdk?.Map) {
        resolve(sdk);
        return;
      }
      reject(new Error('地图加载失败，请稍后再试'));
    };
    const rejectLoad = () => reject(new Error('地图加载失败，请稍后再试'));
    const existing = document.getElementById('snowlit-amap-js-api') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', resolveLoadedSdk);
      existing.addEventListener('error', rejectLoad);
      return;
    }

    const script = document.createElement('script');
    script.id = 'snowlit-amap-js-api';
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(
      key
    )}&plugin=AMap.Geocoder,AMap.PlaceSearch,AMap.AutoComplete`;
    script.onload = resolveLoadedSdk;
    script.onerror = rejectLoad;
    document.head.appendChild(script);
  });

  return sdkLoader;
}

export function readAmapCoordinate(location: unknown): {
  longitude: number;
  latitude: number;
} | null {
  if (!isRecord(location)) {
    return null;
  }

  const longitude = readNumber(location, 'getLng', 'lng', 'longitude');
  const latitude = readNumber(location, 'getLat', 'lat', 'latitude');
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  return { longitude, latitude };
}

export async function searchAmapLocations(keyword: string): Promise<AMapLocationSuggestion[]> {
  const auto = await getAutocompleteService();
  return new Promise((resolve, reject) => {
    auto.search(keyword, (status, result) => {
      if (status === 'no_data') {
        resolve([]);
        return;
      }
      if (status !== 'complete' || !Array.isArray(result?.tips)) {
        reject(new Error('地点联想失败'));
        return;
      }
      resolve(
        result.tips
          .map(normalizeSuggestion)
          .filter((item): item is AMapLocationSuggestion => item !== null)
      );
    });
  });
}

export async function reverseGeocode(
  longitude: number,
  latitude: number
): Promise<{ locationName: string; address: string } | null> {
  const Geocoder = getLoadedAmapSdk()?.Geocoder;
  if (!Geocoder) {
    return null;
  }

  try {
    const geocoder = new Geocoder();
    return await new Promise((resolve) => {
      geocoder.getAddress([longitude, latitude], (_status, result) => {
        const regeocode = result?.regeocode;
        const formattedAddress = String(regeocode?.formattedAddress || '');
        resolve({
          locationName: String(regeocode?.pois?.[0]?.name || formattedAddress || '地图落点'),
          address: formattedAddress
        });
      });
    });
  } catch {
    return null;
  }
}

function getAutocompleteService(): Promise<AMapAutocompleteInstance> {
  if (autocompleteService) {
    return Promise.resolve(autocompleteService);
  }
  if (autocompleteLoader) {
    return autocompleteLoader;
  }

  const sdk = getLoadedAmapSdk();
  if (!sdk) {
    return Promise.reject(new Error('高德地图服务尚未加载，可先点击地图选点'));
  }

  autocompleteLoader = new Promise((resolve, reject) => {
    const createService = () => {
      const AutoComplete = getLoadedAmapSdk()?.AutoComplete;
      if (!AutoComplete) {
        reject(new Error('高德输入提示服务尚未加载'));
        return;
      }
      autocompleteService = new AutoComplete({ datatype: 'poi' });
      resolve(autocompleteService);
    };

    if (sdk.AutoComplete) {
      createService();
      return;
    }
    if (sdk.plugin) {
      sdk.plugin(['AMap.AutoComplete'], createService);
      return;
    }
    reject(new Error('高德输入提示服务尚未加载'));
  });

  return autocompleteLoader;
}

function normalizeSuggestion(value: unknown): AMapLocationSuggestion | null {
  if (!isRecord(value)) {
    return null;
  }
  const coordinate = readAmapCoordinate(value.location);
  if (!coordinate) {
    return null;
  }

  const name = String(value.name || '未命名地点');
  const adcode = String(value.adcode || '');
  return {
    id: String(value.id || `${name}-${adcode}-${coordinate.longitude}-${coordinate.latitude}`),
    name,
    address: String(value.address || value.district || ''),
    ...coordinate
  };
}

function readNumber(
  value: Record<string, unknown>,
  getterKey: string,
  primaryKey: string,
  fallbackKey: string
): number {
  const getter = value[getterKey];
  if (typeof getter === 'function') {
    return Number(getter.call(value));
  }
  return Number(value[primaryKey] ?? value[fallbackKey]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
