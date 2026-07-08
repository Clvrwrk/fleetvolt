// Weather preset adjustments — port of weather.py (D-09).

import { airDensity } from "./physicsEngine";
import type { ConditionsSpec, TruckParams, WeatherAdjustment, WeatherPresetName } from "./types";

export const WEATHER_PRESETS: Record<
  WeatherPresetName,
  { temp_c: number; headwind_mph: number; thermal_factor: number; aux_mult: number }
> = {
  ideal: { temp_c: 20, headwind_mph: 0, thermal_factor: 1.0, aux_mult: 1.0 },
  hot: { temp_c: 35, headwind_mph: 0, thermal_factor: 0.94, aux_mult: 1.15 },
  cold: { temp_c: 0, headwind_mph: 0, thermal_factor: 0.92, aux_mult: 1.5 },
  headwind: { temp_c: 20, headwind_mph: 15, thermal_factor: 1.0, aux_mult: 1.0 },
};

/** Return weather-adjusted air density and multipliers for physics_engine. */
export function applyWeather(
  truck: TruckParams,
  conditions: ConditionsSpec,
): WeatherAdjustment {
  // reserved for truck-specific thermal curves in future plans
  void truck;
  const preset = WEATHER_PRESETS[(conditions.weather_preset ?? "ideal") as WeatherPresetName];
  const tempC = preset.temp_c;
  return {
    rho: airDensity(tempC),
    thermal_factor: preset.thermal_factor,
    aux_mult: preset.aux_mult,
    headwind_mph: preset.headwind_mph,
    temp_c: tempC,
  };
}
