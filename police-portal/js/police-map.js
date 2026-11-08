/**
 * SheGuard Law Enforcement Portal - Police Tactical Incident GIS Map
 * Architecture: FRONTEND 2 (Leaflet.js + OpenStreetMap Law Enforcement GIS)
 */

import { policeApi } from './police-api.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceMapController {
  constructor() {
    this.map = null;
    this.markersLayer = null;
    this.reports = [];
    this.activeCategory = 'ALL';
    this.activeStatus = 'ALL';
    this.activeDays = 30;
  }

  async init() {
    this.initLeaflet();
    await this.loadMapData();
    this.bindEvents();
  }

  initLeaflet() {
    const mapEl = document.getElementById('policeGisMap');
    if (!mapEl || typeof L === 'undefined') return;

    // Default center on National Capital Region / India Center
    this.map = L.map('policeGisMap', {
      zoomControl: true,
      maxZoom: 19,
      minZoom: 4
    }).setView([28.6139, 77.2090], 11);

    // High contrast dark command tile layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | SheGuard Tactical GIS'
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);
  }

  async loadMapData() {
    try {
      this.reports = await policeApi.getReports();
      this.renderMarkers();
    } catch (e) {
      showPoliceToast('Failed to load incident coordinates: ' + e.message, 'danger');
    }
  }

  bindEvents() {
    const catFilter = document.getElementById('mapCategoryFilter');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.activeCategory = e.target.value;
        this.renderMarkers();
      });
    }

    const statusFilter = document.getElementById('mapStatusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.activeStatus = e.target.value;
        this.renderMarkers();
      });
    }

    const dateFilter = document.getElementById('mapDateFilter');
    if (dateFilter) {
      dateFilter.addEventListener('change', (e) => {
        this.activeDays = parseInt(e.target.value, 10);
        this.renderMarkers();
      });
    }

    const recenterBtn = document.getElementById('mapRecenterBtn');
    if (recenterBtn) {
      recenterBtn.addEventListener('click', () => {
        if (this.reports.length > 0) {
          const valid = this.reports.filter(r => r.location?.latitude && r.location?.longitude);
          if (valid.length > 0) {
            const group = L.featureGroup(valid.map(r => L.marker([r.location.latitude, r.location.longitude])));
            this.map.fitBounds(group.getBounds().pad(0.1));
            return;
          }
        }
        this.map.setView([28.6139, 77.2090], 11);
      });
    }
  }

  getFilteredReports() {
    const cutoffTime = Date.now() - (this.activeDays * 86400000);

    return this.reports.filter(r => {
      if (!r.location || !r.location.latitude || !r.location.longitude) return false;
      if (r.createdAt && r.createdAt < cutoffTime) return false;

      if (this.activeCategory !== 'ALL' && (r.category || '').toLowerCase() !== this.activeCategory.toLowerCase()) {
        return false;
      }

      if (this.activeStatus !== 'ALL') {
        const s = (r.status || '').toUpperCase();
        if (this.activeStatus === 'VERIFIED' && s !== 'VERIFIED') return false;
        if (this.activeStatus === 'INVESTIGATING' && s !== 'UNDER_INVESTIGATION' && s !== 'ASSIGNED') return false;
        if (this.activeStatus === 'PENDING' && !s.includes('PENDING') && s !== 'SUBMITTED') return false;
      }

      return true;
    });
  }

  renderMarkers() {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();

    const filtered = this.getFilteredReports();
    const countEl = document.getElementById('mapIncidentCount');
    if (countEl) countEl.textContent = `${filtered.length} tactical points`;

    const bounds = [];

    filtered.forEach(r => {
      const lat = r.location.latitude;
      const lon = r.location.longitude;
      const color = this.getCategoryColor(r.category);

      const circle = L.circleMarker([lat, lon], {
        radius: 8,
        fillColor: color,
        color: '#FFFFFF',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      const popupContent = `
        <div style="font-family: var(--font-main); color: #0F172A; min-width: 200px; padding: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #2563EB; font-family: var(--font-mono); font-size: 13px;">${r.reference}</strong>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; background: #E2E8F0; border-radius: 4px;">${(r.status || 'SUBMITTED').replace(/_/g, ' ')}</span>
          </div>
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">${this.formatCategory(r.category)}</div>
          <div style="font-size: 11px; color: #64748B; margin-bottom: 8px;">📍 ${r.location.address || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}</div>
          <a href="police-investigation.html?ref=${encodeURIComponent(r.reference)}" style="display: block; text-align: center; background: #1E293B; color: #fff; padding: 5px 8px; border-radius: 4px; font-size: 11px; text-decoration: none; font-weight: 600;">
            Open Investigation Dossier &rarr;
          </a>
        </div>
      `;

      circle.bindPopup(popupContent);
      this.markersLayer.addLayer(circle);
      bounds.push([lat, lon]);
    });

    if (bounds.length > 0) {
      this.map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
  }

  getCategoryColor(category) {
    switch ((category || '').toLowerCase()) {
      case 'physical_assault': return '#EF4444'; // Red
      case 'harassment': return '#F97316'; // Orange
      case 'stalking': return '#8B5CF6'; // Purple
      case 'threats': return '#EC4899'; // Pink
      case 'cyber_harassment': return '#06B6D4'; // Cyan
      case 'unsafe_location': return '#3B82F6'; // Blue
      default: return '#10B981'; // Emerald
    }
  }

  formatCategory(cat) {
    const map = {
      harassment: 'Harassment / Eve Teasing',
      stalking: 'Stalking / Following',
      physical_assault: 'Physical Assault',
      threats: 'Threats / Intimidation',
      cyber_harassment: 'Cyber Harassment',
      unsafe_location: 'Unsafe Location',
      other: 'Other Safety Incident'
    };
    return map[cat] || (cat ? cat.replace(/_/g, ' ') : 'General Safety');
  }
}
