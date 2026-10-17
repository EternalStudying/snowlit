import {
  onMounted,
  ref,
  type Ref
} from 'vue';
import type { WeatherAtmosphereData } from '../../weather';
import type {
  HomeLocationSnapshot,
  HomeOverview
} from '../model';
import { createHttpHomeGateway } from './httpHomeGateway';
import type { HomeGateway } from './ports';

interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface HomeLifecycleState {
  overview: Readonly<Ref<HomeOverview | null>>;
  loading: Readonly<Ref<boolean>>;
  loaded: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string>>;
}

export interface HomeLifecycle {
  state: HomeLifecycleState;
  loadOverview(force?: boolean): Promise<HomeOverview | null>;
  refreshOverview(): Promise<HomeOverview | null>;
  syncWeatherLocation(
    weather: WeatherAtmosphereData | null | undefined,
    coordinates: Coordinates | null | undefined
  ): Promise<void>;
}

export interface HomeLifecycleOptions {
  gateway?: HomeGateway;
}

export function createHomeLifecycle({
  gateway: providedGateway
}: HomeLifecycleOptions = {}): HomeLifecycle {
  const gateway = providedGateway ?? createHttpHomeGateway();
  const overview = ref<HomeOverview | null>(null);
  const loading = ref(false);
  const loaded = ref(false);
  const error = ref('');
  let loadIntent = 0;
  let locationIntent = 0;
  let pendingLoad: Promise<HomeOverview | null> | null = null;
  let pendingLocation:
    | { signature: string; promise: Promise<void> }
    | null = null;
  let lastReportedLocationSignature = '';

  function loadOverview(
    force = false
  ): Promise<HomeOverview | null> {
    if (overview.value && !force) {
      return Promise.resolve(overview.value);
    }
    if (pendingLoad && !force) {
      return pendingLoad;
    }

    const intent = ++loadIntent;
    loading.value = true;
    error.value = '';
    const request = gateway
      .fetchOverview()
      .then((data) => {
        if (intent !== loadIntent) {
          return null;
        }
        overview.value = data;
        loaded.value = true;
        return data;
      })
      .catch((loadError) => {
        if (intent === loadIntent) {
          error.value = errorMessage(
            loadError,
            '首页数据加载失败'
          );
        }
        return null;
      });
    const tracked = request.finally(() => {
      if (intent === loadIntent) {
        loading.value = false;
      }
      if (pendingLoad === tracked) {
        pendingLoad = null;
      }
    });
    pendingLoad = tracked;
    return tracked;
  }

  function refreshOverview(): Promise<HomeOverview | null> {
    return loadOverview(true);
  }

  function syncWeatherLocation(
    weather: WeatherAtmosphereData | null | undefined,
    coordinates: Coordinates | null | undefined
  ): Promise<void> {
    const snapshot = createLocationSnapshot(
      weather,
      coordinates
    );
    if (!snapshot) {
      return Promise.resolve();
    }

    const signature = JSON.stringify(snapshot);
    if (signature === lastReportedLocationSignature) {
      return Promise.resolve();
    }
    if (pendingLocation?.signature === signature) {
      return pendingLocation.promise;
    }

    const intent = ++locationIntent;
    const request = gateway
      .reportLocation(snapshot)
      .then(async () => {
        if (intent === locationIntent) {
          lastReportedLocationSignature = signature;
        }
        await refreshOverview();
      })
      .catch((reportError) => {
        if (intent === locationIntent) {
          error.value = errorMessage(
            reportError,
            '位置上报失败'
          );
        }
      });
    const tracked = request.finally(() => {
      if (pendingLocation?.promise === tracked) {
        pendingLocation = null;
      }
    });
    pendingLocation = { signature, promise: tracked };
    return tracked;
  }

  return {
    state: {
      overview,
      loading,
      loaded,
      error
    },
    loadOverview,
    refreshOverview,
    syncWeatherLocation
  };
}

let defaultLifecycle = createHomeLifecycle();

export function useHomeLifecycle(): HomeLifecycle {
  onMounted(() => {
    void defaultLifecycle.loadOverview();
  });
  return defaultLifecycle;
}

export function syncHomeLocationFromWeather(
  weather: WeatherAtmosphereData | null | undefined,
  coordinates: Coordinates | null | undefined
): Promise<void> {
  return defaultLifecycle.syncWeatherLocation(
    weather,
    coordinates
  );
}

export function resetHomeLifecycleForTests(): void {
  defaultLifecycle = createHomeLifecycle();
}

function createLocationSnapshot(
  weather: WeatherAtmosphereData | null | undefined,
  coordinates: Coordinates | null | undefined
): HomeLocationSnapshot | null {
  if (
    !weather ||
    !coordinates ||
    !isFiniteCoordinate(coordinates.latitude) ||
    !isFiniteCoordinate(coordinates.longitude)
  ) {
    return null;
  }

  const location = {
    city: locationText(weather.city),
    district: locationText(weather.district),
    province: locationText(weather.province),
    country: locationText(weather.country)
  };
  if (!Object.values(location).some(Boolean)) {
    return null;
  }

  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    ...location,
    weather:
      weather.weatherVariant === 'unknown'
        ? null
        : cleanText(weather.rawWeather) ||
          cleanText(weather.weatherVariant) ||
          cleanText(weather.weatherState) || null,
    temperature:
      typeof weather.temperature === 'number' &&
      Number.isFinite(weather.temperature)
        ? weather.temperature
        : null
  };
}

function locationText(value: unknown): string {
  const text = cleanText(value);
  return /^(unknown|未知|位置待更新|城市待更新)$/i.test(text) ? '' : text;
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

function cleanText(value: unknown): string {
  const text = String(value ?? '').trim();
  if (
    !text ||
    text === 'undefined' ||
    text === 'null' ||
    text === 'NaN'
  ) {
    return '';
  }
  return text;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
