/**
 * SheGuard - OpenStreetMap-compatible OSRM Routing Service
 * Provides genuine road routes, distance, duration, and external navigation fallbacks.
 */
import { CONFIG } from './config.js';

export class RoutingService {
  constructor() {
    this.baseUrl = CONFIG.ROUTING.OSRM_BASE_URL;
  }

  /**
   * Fetches real road routing between two coordinates
   * @param {number} startLat 
   * @param {number} startLon 
   * @param {number} destLat 
   * @param {number} destLon 
   * @param {'walking'|'driving'} profile 
   * @returns {Promise<{distanceKm: number, durationMinutes: number, coordinates: [number, number][], isRouteAvailable: boolean}>}
   */
  async getRoute(startLat, startLon, destLat, destLon, profile = 'driving') {
    const osrmProfile = profile === 'walking' ? 'foot' : 'car';
    // OSRM expects coordinates in lon,lat order
    const url = `${this.baseUrl}/route/v1/${osrmProfile}/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.ROUTING.TIMEOUT_MS || 8000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Routing service returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
        return {
          isRouteAvailable: false,
          error: data.message || 'No route could be calculated between these coordinates.',
          distanceKm: null,
          durationMinutes: null,
          coordinates: []
        };
      }

      const primaryRoute = data.routes[0];
      const distanceMeters = primaryRoute.distance;
      const durationSeconds = primaryRoute.duration;

      // Leaflet GeoJSON format: array of [lat, lon]
      const coordinates = primaryRoute.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

      return {
        isRouteAvailable: true,
        distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
        durationMinutes: Math.round(durationSeconds / 60),
        coordinates: coordinates,
        profile: profile
      };
    } catch (err) {
      clearTimeout(timeout);
      console.warn('[SheGuard Routing] Routing service unavailable or failed:', err.message);
      return {
        isRouteAvailable: false,
        error: `Live routing service unavailable (${err.message}). Use external navigation fallback.`,
        distanceKm: null,
        durationMinutes: null,
        coordinates: []
      };
    }
  }

  /**
   * Generates genuine external navigation links to Google Maps or OpenStreetMap
   */
  getExternalNavigationUrl(destLat, destLon, startLat = null, startLon = null) {
    if (startLat && startLon) {
      return `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLon}&destination=${destLat},${destLon}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${destLat},${destLon}`;
  }
}

export const routingService = new RoutingService();
