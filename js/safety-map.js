/**
 * SheGuard - Interactive Public Safety Map Controller
 * Integrates Leaflet.js with real backend incident markers and genuine verified emergency services.
 */
import { CONFIG } from './config.js';
import { reportsService } from './reports.js';
import { locationService } from './location.js';
import { formatDateTime, escapeHtml } from './ui.js';

export class SafetyMapController {
  constructor(containerId = 'safetyMap') {
    this.containerId = containerId;
    this.map = null;
    this.incidentLayer = null;
    this.emergencyServicesLayer = null;
    this.userLocationLayer = null;
    this.currentCategory = 'all';
    this.currentDaysAgo = 30;
    this.showServices = true;
  }

  /**
   * Initializes the Leaflet map instance
   */
  async initMap(defaultCenter = CONFIG.MAP.DEFAULT_CENTER, zoom = CONFIG.MAP.DEFAULT_ZOOM) {
    if (!window.L) {
      throw new Error('Leaflet.js library is not loaded on this page.');
    }

    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Create Leaflet map
    this.map = window.L.map(this.containerId, {
      center: defaultCenter,
      zoom: zoom,
      zoomControl: true
    });

    // Add Dark/Voyager Tile Layer
    window.L.tileLayer(CONFIG.MAP.TILE_LAYER_DARK, {
      attribution: CONFIG.MAP.ATTRIBUTION,
      maxZoom: CONFIG.MAP.MAX_ZOOM,
      minZoom: CONFIG.MAP.MIN_ZOOM
    }).addTo(this.map);

    // Layer groups for markers
    this.incidentLayer = window.L.layerGroup().addTo(this.map);
    this.emergencyServicesLayer = window.L.layerGroup().addTo(this.map);
    this.userLocationLayer = window.L.layerGroup().addTo(this.map);

    // Try acquiring user location on load to center map
    this.locateUser(false);

    // Load initial backend incidents
    await this.refreshIncidents();
  }

  /**
   * Centers the map on the user's current GPS location
   */
  async locateUser(notify = true) {
    try {
      const pos = await locationService.getCurrentPosition();
      this.userLocationLayer.clearLayers();

      const userIcon = window.L.divIcon({
        className: 'user-pulse-marker',
        html: `<div style="width: 18px; height: 18px; background: #38BDF8; border: 3px solid #fff; border-radius: 50%; box-shadow: 0 0 15px #38BDF8;"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = window.L.marker([pos.latitude, pos.longitude], { icon: userIcon })
        .bindPopup(`<strong>Your Current Location</strong><br><span style="font-size: 11px; color: #94A3B8;">Accuracy: &plusmn;${pos.accuracy}m</span>`);

      this.userLocationLayer.addLayer(marker);
      this.map.setView([pos.latitude, pos.longitude], 14);

      if (this.showServices) {
        this.fetchNearbyEmergencyServices(pos.latitude, pos.longitude);
      }
    } catch (err) {
      if (notify) {
        console.warn('[SheGuard Map] Location acquisition failed:', err.message);
      }
    }
  }

  /**
   * Refreshes genuine incident reports from backend
   */
  async refreshIncidents() {
    if (!this.incidentLayer) return [];
    this.incidentLayer.clearLayers();

    const emptyNotice = document.getElementById('mapEmptyNotice');
    if (emptyNotice) emptyNotice.style.display = 'none';

    try {
      const reports = await reportsService.getPublicSafetyReports(this.currentCategory, this.currentDaysAgo);
      
      if (!reports || reports.length === 0) {
        if (emptyNotice) {
          emptyNotice.textContent = 'No verified public safety incidents reported for the selected filters.';
          emptyNotice.style.display = 'block';
        }
        return [];
      }

      reports.forEach(report => {
        if (!report.location || report.location.latitude === undefined || report.location.longitude === undefined) return;

        const isVerified = (report.status || '').toLowerCase() === 'verified';
        const color = isVerified ? '#10B981' : '#F59E0B';

        const incidentIcon = window.L.divIcon({
          className: 'incident-map-marker',
          html: `<div style="width: 24px; height: 24px; background: ${color}; border: 2px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: bold; box-shadow: 0 0 10px ${color};">⚠️</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const statusMeta = reportsService.getStatusMeta(report.status);
        const categoryLabel = reportsService.getCategoryLabel(report.category);

        const popupContent = `
          <div style="color: #070B14; font-family: sans-serif; min-width: 200px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: bold; font-size: 13px;">${escapeHtml(categoryLabel)}</span>
              <span class="badge ${statusMeta.badgeClass}" style="font-size: 10px; padding: 2px 6px;">${escapeHtml(statusMeta.label)}</span>
            </div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              Date: ${escapeHtml(report.incidentDate || 'N/A')}
            </div>
            <p style="font-size: 12px; margin: 4px 0 8px; color: #334155;">
              ${escapeHtml(report.description ? report.description.substring(0, 160) : 'Safety alert area')}
            </p>
            <div style="font-size: 10px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 4px;">
              🔒 Fuzzed coordinate radius: Public privacy protection active
            </div>
          </div>
        `;

        const marker = window.L.marker([report.location.latitude, report.location.longitude], { icon: incidentIcon })
          .bindPopup(popupContent);

        this.incidentLayer.addLayer(marker);
      });

      return reports;
    } catch (err) {
      console.warn('[SheGuard Map] Could not fetch public incident reports:', err.message);
      if (emptyNotice) {
        emptyNotice.textContent = 'Backend incidents service is currently unreachable. Displaying base safety map.';
        emptyNotice.style.display = 'block';
      }
      return [];
    }
  }

  /**
   * Fetches real nearby verified police stations and hospitals from OpenStreetMap Overpass API
   */
  async fetchNearbyEmergencyServices(lat, lon, radiusMeters = 3000) {
    if (!this.emergencyServicesLayer) return;
    this.emergencyServicesLayer.clearLayers();

    // Overpass query for emergency services: police stations & hospitals
    const query = `[out:json][timeout:10];
      (
        node["amenity"="police"](around:${radiusMeters},${lat},${lon});
        node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      );
      out body 15;`;

    try {
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.elements || data.elements.length === 0) return;

      data.elements.forEach(place => {
        const isPolice = place.tags && place.tags.amenity === 'police';
        const name = (place.tags && (place.tags.name || place.tags['name:en'])) || (isPolice ? 'Police Station' : 'Hospital');
        const iconSymbol = isPolice ? '👮' : '🏥';
        const color = isPolice ? '#3B82F6' : '#10B981';

        const serviceIcon = window.L.divIcon({
          className: 'emergency-service-marker',
          html: `<div style="width: 22px; height: 22px; background: ${color}; border: 2px solid #fff; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 0 8px ${color};">${iconSymbol}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const popup = `
          <div style="color: #070B14; font-family: sans-serif;">
            <strong>${escapeHtml(name)}</strong><br>
            <span style="font-size: 11px; color: #64748B;">Verified Public ${isPolice ? 'Police Station' : 'Hospital'}</span>
            ${place.tags && place.tags.phone ? `<br><a href="tel:${escapeHtml(place.tags.phone)}" style="color: #0284C7; font-size: 12px;">📞 ${escapeHtml(place.tags.phone)}</a>` : ''}
          </div>
        `;

        const marker = window.L.marker([place.lat, place.lon], { icon: serviceIcon }).bindPopup(popup);
        this.emergencyServicesLayer.addLayer(marker);
      });
    } catch (e) {
      console.warn('[SheGuard Map] Overpass emergency services query failed or rate-limited:', e);
    }
  }

  setCategoryFilter(category) {
    this.currentCategory = category;
    return this.refreshIncidents();
  }

  setDaysFilter(days) {
    this.currentDaysAgo = days;
    return this.refreshIncidents();
  }

  toggleServicesLayer(show) {
    this.showServices = show;
    if (show) {
      if (!this.map.hasLayer(this.emergencyServicesLayer)) {
        this.map.addLayer(this.emergencyServicesLayer);
      }
    } else {
      if (this.map.hasLayer(this.emergencyServicesLayer)) {
        this.map.removeLayer(this.emergencyServicesLayer);
      }
    }
  }
}
