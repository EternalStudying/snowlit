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
import { onSessionChange } from '../../../auth';
import { errorMessage } from '../../../display';
import { createLatestRequest } from '../../../requestGuards';

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
  const latestLoad = createLatestRequest();
  const latestLocation = createLatestRequest();
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

    const isCurrent = latestLoad.begin();
    loading.value = true;
    error.value = '';
    const request = gateway
      .fetchOverview()
      .then((data) => {
        if (!isCurrent()) {
          return null;
        }
        overview.value = data;
        loaded.value = true;
        return data;
      })
      .catch((loadError) => {
        if (isCurrent()) {
          error.value = errorMessage(
            loadError,
            '首页数据加载失败'
          );
        }
        return null;
      });
    const tracked = request.finally(() => {
      if (isCurrent()) {
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

    const isCurrent = latestLocation.begin();
    const request = gateway
      .reportLocation(snapshot)
      .then(async () => {
        if (!isCurrent()) {
          return;
        }
        lastReportedLocationSignature = signature;
        await refreshOverview();
      })
      .catch((reportError) => {
        if (isCurrent()) {
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

  // The overview belongs to the signed-in member; a session change must not show it to the next one.
  onSessionChange(() => {
    latestLoad.cancel();
    latestLocation.cancel();
    pendingLoad = null;
    pendingLocation = null;
    lastReportedLocationSignature = '';
    overview.value = null;
    loading.value = false;
    loaded.value = false;
    error.value = '';
  });

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
        : weather.rawWeather || weather.weatherVariant,
    temperature: weather.temperature
  };
}

function locationText(value: string): string {
  const text = value.trim();
  return /^(unknown|未知|位置待更新|城市待更新)$/i.test(text) ? '' : text;
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

