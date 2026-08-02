import { z } from "zod";
import { tool } from "ai";
import type { WeatherConfig } from "../types";

type GeocodeResult = {
  name: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export function buildTool(config: WeatherConfig) {
  void config;
  return tool({
    description: "Get the current weather for a location, via Open-Meteo (no API key required).",
    inputSchema: z.object({
      location: z.string().describe('e.g. "Tokyo" or "Paris, France"'),
    }),
    execute: async ({ location }) => {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`,
      );
      if (!geoRes.ok) {
        throw new Error(`Open-Meteo geocoding failed: ${geoRes.status} ${geoRes.statusText}`);
      }
      const geoData = (await geoRes.json()) as { results?: GeocodeResult[] };
      const place = geoData.results?.[0];
      if (!place) {
        throw new Error(`No location found for "${location}"`);
      }

      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`,
      );
      if (!forecastRes.ok) {
        throw new Error(`Open-Meteo forecast failed: ${forecastRes.status} ${forecastRes.statusText}`);
      }
      const forecastData = await forecastRes.json();

      return {
        location: place.country ? `${place.name}, ${place.country}` : place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        current: forecastData.current,
      };
    },
  });
}
