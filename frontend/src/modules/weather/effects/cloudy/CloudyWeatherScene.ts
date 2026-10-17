import type { WeatherController } from '../../core/WeatherController';
import type { WeatherFrameState, WeatherProfile, WeatherRuntimeState } from '../../core/types';

export class CloudyWeatherScene {
  constructor(private readonly controller: WeatherController, profile: WeatherProfile) {
    this.setProfile(profile);
  }

  setProfile(profile: WeatherProfile) {
    this.controller.setWeatherProfile(profile);
  }

  update(_frame: WeatherFrameState, _runtime: WeatherRuntimeState) {}

  dispose() {}
}
