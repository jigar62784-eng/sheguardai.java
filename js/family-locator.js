/**
 * SheGuard - Live Family Locator Controller
 * Real location tracking, Haversine proximity calculation, nearest member triage, and OSRM route navigation.
 */
import { CONFIG } from './config.js';
import { api } from './api.js';
import { locationService } from './location.js';
import { calculateDistance, formatDistance } from './distance.js';
import { routingService } from './routing.js';
import { formatDateTime, timeAgo, escapeHtml, showToast } from './ui.js';

export class FamilyLocatorController {
  constructor(containerId = 'familyMap') {
    this.containerId = containerId;
    this.map = null;
    this.userMarker = null;
    this.membersLayer = null;
    this.routeLayer = null;
    this.currentUserCoords = null;
    this.familyLocations = [];
    this.watchId = null;
  }

  /**
   * Initializes the family map
   */
  async initMap() {
    if (!window.L) {
      throw new Error('Leaflet.js library is not available.');
    }

    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.map = window.L.map(this.containerId, {
      center: CONFIG.MAP.DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true
    });

    window.L.tileLayer(CONFIG.MAP.TILE_LAYER_DARK, {
      attribution: CONFIG.MAP.ATTRIBUTION,
      maxZoom: CONFIG.MAP.MAX_ZOOM,
      minZoom: CONFIG.MAP.MIN_ZOOM
    }).addTo(this.map);

    this.membersLayer = window.L.layerGroup().addTo(this.map);
    this.routeLayer = window.L.layerGroup().addTo(this.map);

    // 1. Acquire current user location
    await this.acquireUserLocation();

    // 2. Fetch authorized family members' shared locations
    await this.refreshFamilyLocations();

    // 3. Start live location watch
    this.startLiveLocationWatch();
  }

  /**
   * Fetches user position and broadcasts it to backend if location sharing is enabled
   */
  async acquireUserLocation() {
    try {
      const pos = await locationService.getCurrentPosition();
      this.currentUserCoords = pos;
      this.renderUserMarker(pos);

      // Share live location with authorized family members via backend
      try {
        await api.post('/locations/share', {
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          timestamp: pos.timestamp
        });
      } catch (err) {
        // Backend might be offline or sharing paused
      }

      return pos;
    } catch (err) {
      showToast(err.message, 'warning');
      return null;
    }
  }

  startLiveLocationWatch() {
    this.watchId = locationService.watchPosition(
      async (pos) => {
        this.currentUserCoords = pos;
        this.renderUserMarker(pos);
        // Periodically refresh proximity & map calculations
        this.recalculateDistances();
      },
      (err) => {
        console.warn('[Family Locator] Watch position notice:', err.message);
      }
    );
  }

  renderUserMarker(pos) {
    if (!this.map) return;

    const userHtml = `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(56, 189, 248, 0.35); animation: pulse 2s infinite;"></div>
        <div style="width: 14px; height: 14px; background: #38BDF8; border: 2.5px solid #FFFFFF; border-radius: 50%; z-index: 2;"></div>
      </div>
    `;

    const icon = window.L.divIcon({
      className: 'user-marker',
      html: userHtml,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (this.userMarker) {
      this.userMarker.setLatLng([pos.latitude, pos.longitude]);
    } else {
      this.userMarker = window.L.marker([pos.latitude, pos.longitude], { icon })
        .bindPopup('<strong>You are here</strong><br><span style="font-size: 11px; color: #94A3B8;">GPS Active</span>')
        .addTo(this.map);
      this.map.setView([pos.latitude, pos.longitude], 14);
    }
  }

  /**
   * Fetches real family locations from backend API
   */
  async refreshFamilyLocations() {
    if (!this.membersLayer) return;
    this.membersLayer.clearLayers();

    const familyListContainer = document.getElementById('familyMemberList');
    const nearestContainer = document.getElementById('nearestMemberPanel');

    try {
      const members = await api.get('/family/locations');
      this.familyLocations = members || [];

      if (!this.familyLocations || this.familyLocations.length === 0) {
        if (familyListContainer) {
          familyListContainer.innerHTML = `
            <div class="empty-state" style="padding: var(--space-6);">
              <div class="empty-state-icon">👨‍👩‍👧</div>
              <h4 style="color: #fff; margin-bottom: 4px;">No Shared Locations Yet</h4>
              <p style="font-size: 12px; color: #94A3B8;">Invite family members in Family Settings to see their live safety location.</p>
              <a href="family.html" class="btn btn-secondary btn-sm" style="margin-top: 12px;">Manage Family Circle</a>
            </div>
          `;
        }
        if (nearestContainer) {
          nearestContainer.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No active family members in range.</p>`;
        }
        return;
      }

      // Process locations and calculate distances
      this.recalculateDistances();
    } catch (err) {
      console.warn('[Family Locator] Failed to load family locations:', err.message);
      if (familyListContainer) {
        familyListContainer.innerHTML = `
          <div class="alert alert-warning" style="font-size: 12px;">
            Unable to connect to Family Location service: ${escapeHtml(err.message)}
          </div>
        `;
      }
    }
  }

  /**
   * Calculates Haversine distance, filters eligible members, and sorts by proximity
   */
  recalculateDistances() {
    const listContainer = document.getElementById('familyMemberList');
    const nearestContainer = document.getElementById('nearestMemberPanel');
    if (!this.membersLayer) return;

    this.membersLayer.clearLayers();

    // Map each member with computed distance
    const evaluatedMembers = this.familyLocations.map(member => {
      const hasCoords = member.latitude !== undefined && member.latitude !== null &&
                        member.longitude !== undefined && member.longitude !== null;
      
      const isLive = member.timestamp ? locationService.isLocationLive(member.timestamp) : false;
      
      let distanceKm = null;
      if (hasCoords && this.currentUserCoords) {
        distanceKm = calculateDistance(
          this.currentUserCoords.latitude,
          this.currentUserCoords.longitude,
          member.latitude,
          member.longitude
        );
      }

      return {
        ...member,
        hasCoords,
        isLive,
        distanceKm
      };
    });

    // Filter eligible members for nearest triage (must have coords and consent)
    const eligibleMembers = evaluatedMembers.filter(m => m.hasCoords && m.sharingEnabled !== false);
    eligibleMembers.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    // Render Markers on Map
    evaluatedMembers.forEach(member => {
      if (!member.hasCoords) return;

      const markerColor = member.isLive ? '#10B981' : '#64748B';
      const icon = window.L.divIcon({
        className: 'family-member-marker',
        html: `
          <div style="background: ${markerColor}; width: 32px; height: 32px; border: 2.5px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: bold; box-shadow: 0 0 12px ${markerColor};">
            ${escapeHtml((member.displayName || 'FM').substring(0, 2).toUpperCase())}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const distLabel = member.distanceKm !== null ? `(${formatDistance(member.distanceKm)} straight-line)` : '';
      const popupHtml = `
        <div style="color: #070B14; font-family: sans-serif; min-width: 180px;">
          <strong style="font-size: 14px;">${escapeHtml(member.displayName || 'Family Member')}</strong><br>
          <span style="font-size: 11px; color: ${member.isLive ? '#059669' : '#64748B'}; font-weight: bold;">
            ${member.isLive ? '🟢 Live Shared Location' : '⚪ Stale Location (>30m)'}
          </span><br>
          <span style="font-size: 11px; color: #64748B;">Updated: ${timeAgo(member.timestamp)}</span><br>
          <span style="font-size: 12px; font-weight: bold; color: #0284C7;">${distLabel}</span>
          <div style="margin-top: 8px; display: flex; gap: 6px;">
            <button class="btn btn-primary btn-sm get-directions-btn" data-lat="${member.latitude}" data-lon="${member.longitude}" data-name="${escapeHtml(member.displayName || 'Member')}" style="font-size: 11px; padding: 3px 8px;">Navigate</button>
            ${member.phoneNumber ? `<a href="tel:${escapeHtml(member.phoneNumber)}" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 8px;">Call</a>` : ''}
          </div>
        </div>
      `;

      const marker = window.L.marker([member.latitude, member.longitude], { icon })
        .bindPopup(popupHtml);

      this.membersLayer.addLayer(marker);
    });

    // Render Nearest Member Panel
    if (nearestContainer) {
      const nearest = eligibleMembers[0];
      if (nearest && nearest.distanceKm !== null) {
        nearestContainer.innerHTML = `
          <div class="nearest-member-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <span class="badge ${nearest.isLive ? 'badge-live' : 'badge-stale'}" style="margin-bottom: 4px;">
                  ${nearest.isLive ? '🟢 Live' : '⚪ Stale'}
                </span>
                <h4 style="font-size: 16px; color: #fff; margin: 2px 0;">${escapeHtml(nearest.displayName || 'Family Member')}</h4>
                <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(nearest.relationship || 'Trusted Family')}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 20px; font-weight: bold; color: var(--accent-cyan); font-family: var(--font-family-mono);">
                  ${formatDistance(nearest.distanceKm)}
                </div>
                <div style="font-size: 10px; color: var(--text-muted);">Straight-line</div>
              </div>
            </div>

            <div id="routeStatsPreview" style="margin: 8px 0; font-size: 12px; color: #94A3B8;">
              <span id="roadDistanceLabel">Click 'Get Directions' to calculate road route via OSRM.</span>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button class="btn btn-primary btn-sm nearest-nav-btn" data-lat="${nearest.latitude}" data-lon="${nearest.longitude}" data-name="${escapeHtml(nearest.displayName)}">
                🗺️ Get Directions
              </button>
              ${nearest.phoneNumber ? `
                <a href="tel:${escapeHtml(nearest.phoneNumber)}" class="btn btn-secondary btn-sm">
                  📞 Call
                </a>
              ` : ''}
              <button class="btn btn-danger btn-sm request-assist-btn" data-name="${escapeHtml(nearest.displayName)}" data-uid="${nearest.userId}">
                🆘 Request Assistance
              </button>
            </div>
          </div>
        `;

        nearestContainer.querySelector('.nearest-nav-btn')?.addEventListener('click', (e) => {
          this.navigateToMember(nearest.latitude, nearest.longitude, nearest.displayName);
        });

        nearestContainer.querySelector('.request-assist-btn')?.addEventListener('click', () => {
          this.sendAssistanceRequest(nearest);
        });
      } else {
        nearestContainer.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No eligible family member coordinates available.</p>`;
      }
    }

    // Render Full List
    if (listContainer) {
      if (evaluatedMembers.length === 0) {
        listContainer.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No family members connected.</p>`;
        return;
      }

      listContainer.innerHTML = evaluatedMembers.map(m => `
        <div class="family-card-item">
          <div class="family-info">
            <h4>${escapeHtml(m.displayName || 'Member')}</h4>
            <div class="family-meta">
              ${m.relationship ? `${escapeHtml(m.relationship)} &bull; ` : ''}
              ${m.hasCoords ? (m.isLive ? '🟢 Live' : '⚪ Stale') : 'Location Not Shared'}
              ${m.distanceKm !== null ? ` &bull; ${formatDistance(m.distanceKm)}` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 4px;">
            ${m.hasCoords ? `
              <button class="btn btn-outline btn-sm list-nav-btn" data-lat="${m.latitude}" data-lon="${m.longitude}" data-name="${escapeHtml(m.displayName)}" title="Navigate">
                🗺️
              </button>
            ` : ''}
            ${m.phoneNumber ? `
              <a href="tel:${escapeHtml(m.phoneNumber)}" class="btn btn-secondary btn-sm" title="Call">
                📞
              </a>
            ` : ''}
          </div>
        </div>
      `).join('');

      // Attach navigation click listeners
      listContainer.querySelectorAll('.list-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const lat = parseFloat(btn.dataset.lat);
          const lon = parseFloat(btn.dataset.lon);
          const name = btn.dataset.name;
          this.navigateToMember(lat, lon, name);
        });
      });
    }

    // Attach popup click listener for dynamic popups
    document.querySelectorAll('.get-directions-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const name = btn.dataset.name;
        this.navigateToMember(lat, lon, name);
      });
    });
  }

  /**
   * Calculates genuine road directions using OSRM and renders route line
   */
  async navigateToMember(destLat, destLon, memberName = 'Family Member') {
    if (!this.currentUserCoords) {
      showToast('Current user coordinates are unavailable. Please allow location access.', 'danger');
      return;
    }

    showToast(`Calculating route to ${memberName} via OSRM...`, 'info');
    this.routeLayer.clearLayers();

    const startLat = this.currentUserCoords.latitude;
    const startLon = this.currentUserCoords.longitude;

    const routeResult = await routingService.getRoute(startLat, startLon, destLat, destLon, 'driving');

    const roadLabel = document.getElementById('roadDistanceLabel');

    if (!routeResult.isRouteAvailable) {
      const fallbackUrl = routingService.getExternalNavigationUrl(destLat, destLon, startLat, startLon);
      if (roadLabel) {
        roadLabel.innerHTML = `
          <span style="color: #F87171;">${escapeHtml(routeResult.error)}</span><br>
          <a href="${fallbackUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="margin-top: 6px;">
            Open in Google Maps Navigation
          </a>
        `;
      }
      showToast('OSRM route calculation unavailable. External fallback provided.', 'warning');
      return;
    }

    // Draw Polyline Route on Leaflet
    const polyline = window.L.polyline(routeResult.coordinates, {
      color: '#38BDF8',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round'
    }).addTo(this.routeLayer);

    this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    if (roadLabel) {
      const fallbackUrl = routingService.getExternalNavigationUrl(destLat, destLon, startLat, startLon);
      roadLabel.innerHTML = `
        <strong style="color: #38BDF8;">Road Distance:</strong> ${routeResult.distanceKm} km &bull; 
        <strong style="color: #38BDF8;">Est. Drive Time:</strong> ~${routeResult.durationMinutes} mins
        <br>
        <a href="${fallbackUrl}" target="_blank" rel="noopener" style="font-size: 11px; color: var(--accent-cyan); text-decoration: underline;">
          Open in Google Maps App
        </a>
      `;
    }

    showToast(`Route displayed: ${routeResult.distanceKm} km (~${routeResult.durationMinutes} mins)`, 'success');
  }

  /**
   * Sends an immediate direct assistance request to a specific family member
   */
  async sendAssistanceRequest(member) {
    if (!this.currentUserCoords) {
      showToast('Your current location is required to send assistance coordinates.', 'danger');
      return;
    }

    try {
      await api.post('/emergency/alerts', {
        type: 'ASSISTANCE_REQUEST',
        targetUserId: member.userId,
        location: {
          latitude: this.currentUserCoords.latitude,
          longitude: this.currentUserCoords.longitude
        },
        message: `I need your assistance right now. My current location is attached.`
      });
      showToast(`Assistance request dispatched to ${member.displayName || 'family member'}.`, 'success');
    } catch (err) {
      showToast(`Failed to send assistance request: ${err.message}`, 'danger');
    }
  }

  destroy() {
    if (this.watchId !== null) {
      locationService.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
