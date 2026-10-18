import { onMounted, onUnmounted, ref } from 'vue';
import { getAuthToken, sessionEpoch } from '../../../auth';
import type { WeatherAtmosphereData, WeatherCoordinates } from '../model';
import { startWeatherUpdates, useWeatherAtmosphereData } from './useWeatherAtmosphereData';

const CONSENT_KEY = 'snowlit-weather-location-consent';

type WeatherListener = (
  data: WeatherAtmosphereData,
  coordinates: WeatherCoordinates | null
) => void | Promise<void>;

/**
 * Automatic, location-based weather for a signed-in member: the location consent (remembered in this
 * browser), the 20-minute foreground schedule, and manual refreshes. `onUpdated` hears every update that
 * still belongs to the session that asked for it.
 */
export function useAutomaticWeather(onUpdated: WeatherListener) {
  const { weather, loading, error, lastCoordinates, loadWeather } = useWeatherAtmosphereData();
  const storedConsent = localStorage.getItem(CONSENT_KEY);
  const enabled = ref(storedConsent === 'enabled');
  const consentPromptVisible = ref(false);
  let stopUpdates: (() => void) | undefined;

  const notify = (data: WeatherAtmosphereData) => onUpdated(data, lastCoordinates.value);

  function startSchedule() {
    stopUpdates?.();
    stopUpdates = startWeatherUpdates(notify);
  }

  function acceptConsent() {
    consentPromptVisible.value = false;
    enabled.value = true;
    localStorage.setItem(CONSENT_KEY, 'enabled');
    startSchedule();
  }

  function declineConsent() {
    consentPromptVisible.value = false;
    enabled.value = false;
    localStorage.setItem(CONSENT_KEY, 'paused');
  }

  /** Pause when on; otherwise ask for consent again. */
  function toggle() {
    if (enabled.value) {
      stopUpdates?.();
      declineConsent();
    } else {
      consentPromptVisible.value = true;
    }
  }

  /** Update now. Without consent this asks for it instead. */
  async function refreshNow() {
    if (!enabled.value) {
      consentPromptVisible.value = true;
      return;
    }
    const session = sessionEpoch();
    const data = await loadWeather({ force: true, requestLocation: true });
    if (getAuthToken() && session === sessionEpoch()) {
      await notify(data);
    }
    // A successful manual retry resumes scheduling after browser permissions were restored.
    if (!error.value) {
      startSchedule();
    }
  }

  onMounted(() => {
    void loadWeather();
    if (!getAuthToken()) {
      return;
    }
    if (enabled.value) {
      startSchedule();
    } else if (!storedConsent) {
      consentPromptVisible.value = true;
    }
  });
  onUnmounted(() => stopUpdates?.());

  return { weather, loading, error, enabled, consentPromptVisible, acceptConsent, declineConsent, toggle, refreshNow };
}
