import { AtmosphereSystem } from '../systems/AtmosphereSystem';
import { CloudSkySystem } from '../systems/CloudSkySystem';
import { ElectricalSystem } from '../systems/ElectricalSystem';
import { EnvironmentSystem } from '../systems/EnvironmentSystem';
import { NightSkySystem } from '../systems/NightSkySystem';
import { OpticalSystem } from '../systems/OpticalSystem';
import { PrecipitationSystem } from '../systems/PrecipitationSystem';
import type {
  WeatherFrameState,
  WeatherProfile,
  WeatherRuntimeState,
  WeatherSystem,
  WeatherSystemContext,
  WeatherVisualSignals
} from './types';
import { getSkyProfile } from '../profiles/skyProfiles';
import { getWeatherProfile } from '../profiles/weatherProfiles';
import { blendWeatherOrchestration, getWeatherOrchestrationProfile } from './weatherOrchestrationProfile';
import { resolveWeatherTransitionRoute } from './weatherTransitionRoutes';
import { weatherStateParameters } from './weatherStateParameters';
import { WindSystem } from './WindSystem';

export const WEATHER_WIND_BASE_SPEED = 0.18;

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function isSameProfileIdentity(left: WeatherProfile, right: WeatherProfile) {
  return (
    left.weatherState === right.weatherState &&
    left.weatherVariant === right.weatherVariant &&
    left.precipitationKind === right.precipitationKind &&
    (left.daylightHint ?? 'unknown') === (right.daylightHint ?? 'unknown') &&
    Boolean(left.meteorShower) === Boolean(right.meteorShower)
  );
}

export class WeatherController {
  readonly wind: WindSystem;
  readonly visualSignals: WeatherVisualSignals = {
    stormFlash: 0,
    dustFlash: 0
  };
  readonly nightSky: NightSkySystem;
  readonly cloudSky: CloudSkySystem;
  readonly precipitation: PrecipitationSystem;
  readonly atmosphere: AtmosphereSystem;
  readonly electrical: ElectricalSystem;
  readonly optical: OpticalSystem;
  readonly environment: EnvironmentSystem;

  currentProfile: WeatherProfile;
  targetProfile: WeatherProfile;
  transitionProgress = 1;
  transitionSpeed = 0.55;
  runtimeState: WeatherRuntimeState;

  private systems: WeatherSystem[];
  private finalTargetProfile: WeatherProfile;
  private routeQueue: WeatherProfile[] = [];

  constructor(
    profile: WeatherProfile,
    wind = new WindSystem(),
    context?: Omit<WeatherSystemContext, 'wind' | 'visualSignals'>
  ) {
    this.wind = wind;
    const systemContext: WeatherSystemContext | undefined = context
      ? { ...context, wind: this.wind, visualSignals: this.visualSignals }
      : undefined;
    this.currentProfile = profile;
    this.targetProfile = profile;
    this.finalTargetProfile = profile;
    this.runtimeState = this.createRuntimeState();
    this.wind.baseSpeed = WEATHER_WIND_BASE_SPEED * this.runtimeState.windMultiplier;
    this.nightSky = new NightSkySystem(systemContext);
    this.cloudSky = new CloudSkySystem(systemContext);
    this.precipitation = new PrecipitationSystem(systemContext);
    this.atmosphere = new AtmosphereSystem(systemContext);
    this.electrical = new ElectricalSystem(systemContext);
    this.optical = new OpticalSystem(systemContext);
    this.environment = new EnvironmentSystem(systemContext);
    this.systems = [
      this.electrical,
      this.nightSky,
      this.cloudSky,
      this.precipitation,
      this.atmosphere,
      this.optical,
      this.environment
    ];
    this.systems.forEach((system) => system.setProfile(profile));
  }

  setWeatherProfile(profile: WeatherProfile) {
    if (isSameProfileIdentity(this.finalTargetProfile, profile)) {
      return;
    }

    const route = resolveWeatherTransitionRoute(this.targetProfile.weatherState, profile.weatherState);
    const routeProfiles = route.map((weatherState, index) => {
      const isFinalRouteStep = index === route.length - 1 && weatherState === profile.weatherState;

      return isFinalRouteStep
        ? profile
        : getWeatherProfile({ weatherState, weatherVariant: undefined, daylightHint: profile.daylightHint });
    });
    const [nextProfile = profile, ...remainingProfiles] = routeProfiles;

    this.finalTargetProfile = profile;
    this.routeQueue = remainingProfiles;
    this.startTransition(nextProfile);
  }

  update(frame: WeatherFrameState) {
    this.advanceRouteIfSettled();
    this.transitionProgress = Math.min(1, this.transitionProgress + frame.delta * this.transitionSpeed);
    this.runtimeState = this.createRuntimeState();
    this.resetVisualSignals();
    this.wind.baseSpeed = WEATHER_WIND_BASE_SPEED * this.runtimeState.windMultiplier;
    this.wind.update(frame.delta);
    this.systems.forEach((system) => system.update(frame, this.runtimeState));
    return this.runtimeState;
  }

  dispose() {
    this.systems.forEach((system) => system.dispose());
  }

  private createRuntimeState(): WeatherRuntimeState {
    const progress = this.transitionProgress;
    const currentParameters = weatherStateParameters[this.currentProfile.weatherState];
    const targetParameters = weatherStateParameters[this.targetProfile.weatherState];
    const currentSkyProfile = getSkyProfile({
      weatherState: this.currentProfile.weatherState,
      weatherVariant: this.currentProfile.weatherVariant,
      precipitationKind: this.currentProfile.precipitationKind,
      daylightHint: this.currentProfile.daylightHint ?? 'unknown'
    });
    const targetSkyProfile = getSkyProfile({
      weatherState: this.targetProfile.weatherState,
      weatherVariant: this.targetProfile.weatherVariant,
      precipitationKind: this.targetProfile.precipitationKind,
      daylightHint: this.targetProfile.daylightHint ?? 'unknown'
    });
    const orchestration = blendWeatherOrchestration(
      getWeatherOrchestrationProfile(this.currentProfile, currentSkyProfile),
      getWeatherOrchestrationProfile(this.targetProfile, targetSkyProfile),
      progress
    );

    const runtimeState: WeatherRuntimeState = {
      currentProfile: this.currentProfile,
      targetProfile: this.targetProfile,
      transitionProgress: progress,
      orchestration,
      rainIntensity: lerp(currentParameters.rain, targetParameters.rain, progress),
      snowIntensity: lerp(currentParameters.snow, targetParameters.snow, progress),
      fogDensity: lerp(currentParameters.fogDensity, targetParameters.fogDensity, progress),
      lightningIntensity: lerp(currentParameters.lightning, targetParameters.lightning, progress),
      skyDarkness: lerp(currentParameters.skyDarkness, targetParameters.skyDarkness, progress),
      windMultiplier: lerp(currentParameters.windMultiplier, targetParameters.windMultiplier, progress),
      ambientWarmth: lerp(this.currentProfile.ambientWarmth, this.targetProfile.ambientWarmth, progress),
      particleIntensity: lerp(this.currentProfile.particleIntensity, this.targetProfile.particleIntensity, progress)
    };
    runtimeState.orchestration = orchestration;

    return runtimeState;
  }

  private startTransition(profile: WeatherProfile) {
    this.currentProfile = this.targetProfile;
    this.targetProfile = profile;
    this.transitionProgress = 0;
    this.runtimeState = this.createRuntimeState();
    this.systems.forEach((system) => system.setProfile(profile));
  }

  private advanceRouteIfSettled() {
    if (this.transitionProgress < 1 || this.routeQueue.length === 0) {
      return;
    }

    const nextProfile = this.routeQueue.shift();

    if (nextProfile) {
      this.startTransition(nextProfile);
    }
  }

  private resetVisualSignals() {
    this.visualSignals.stormFlash = 0;
    this.visualSignals.dustFlash = 0;
  }
}
