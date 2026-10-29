/**
 * SheGuard - Browser Geolocation API Wrapper & Freshness Evaluator
 */
import { CONFIG } from './config.js';

export class LocationService {
  /**
   * Requests foreground user coordinates via Browser Geolocation API
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: number}>}
   */
  async getCurrentPosition() {
    if (!('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          resolve({
            latitude,
            longitude,
            accuracy: Math.round(accuracy),
            timestamp: position.timestamp || Date.now()
          });
        },
        (error) => {
          let errorMsg = 'Failed to acquire current location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Location access was denied. Please allow location permissions in your browser to use live safety features.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Location information is currently unavailable from your device GPS.';
              break;
            case error.TIMEOUT:
              errorMsg = 'Location request timed out. Please check your GPS signal and try again.';
              break;
          }
          reject(new Error(errorMsg));
        },
        {
          enableHighAccuracy: CONFIG.LOCATION.HIGH_ACCURACY,
          timeout: CONFIG.LOCATION.TIMEOUT_MS,
          maximumAge: CONFIG.LOCATION.MAX_AGE_MS
        }
      );
    });
  }

  /**
   * Starts a continuous watch on user location
   */
  watchPosition(onSuccess, onError) {
    if (!('geolocation' in navigator)) {
      onError(new Error('Geolocation is not supported by your browser.'));
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        onSuccess({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          timestamp: position.timestamp || Date.now()
        });
      },
      (error) => {
        onError(error);
      },
      {
        enableHighAccuracy: CONFIG.LOCATION.HIGH_ACCURACY,
        timeout: CONFIG.LOCATION.TIMEOUT_MS,
        maximumAge: CONFIG.LOCATION.MAX_AGE_MS
      }
    );
  }

  /**
   * Stops a continuous watch
   */
  clearWatch(watchId) {
    if (watchId !== null && watchId !== undefined && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
    }
  }

  /**
   * Checks whether a location timestamp is considered live or stale
   * Threshold is 30 minutes by default
   */
  isLocationLive(timestamp) {
    if (!timestamp) return false;
    const updateTime = new Date(timestamp).getTime();
    if (isNaN(updateTime)) return false;
    const diffMinutes = (Date.now() - updateTime) / (1000 * 60);
    return diffMinutes <= CONFIG.LOCATION.STALE_THRESHOLD_MINUTES;
  }
}

export const locationService = new LocationService();
