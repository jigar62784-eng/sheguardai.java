/**
 * SheGuard Law Enforcement Portal - Tactical Emergency SOS Dispatch Monitor
 * Architecture: FRONTEND 2 (Real-Time SOS Queue, Dispatch & Incident Closure)
 */

import { policeApi } from './police-api.js';
import { policeAuth } from './police-auth.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceEmergencyController {
  constructor() {
    this.alerts = [];
    this.activeFilter = 'ACTIVE';
    this.audioAlertEnabled = true;
    this.pollingInterval = null;
    this.tacticalMap = null;
    this.tacticalMarkerGroup = null;
  }

  async init() {
    this.initMap();
    await this.loadAlerts();
    this.bindEvents();

    // High frequency 5s polling for emergency monitoring
    this.pollingInterval = setInterval(() => this.loadAlerts(true), 5000);
  }

  destroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  initMap() {
    const mapEl = document.getElementById('emergencyTacticalMap');
    if (!mapEl || typeof L === 'undefined') return;

    this.tacticalMap = L.map('emergencyTacticalMap', {
      zoomControl: true,
      maxZoom: 18
    }).setView([28.6139, 77.2090], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap | Tactical SOS Radar'
    }).addTo(this.tacticalMap);

    this.tacticalMarkerGroup = L.layerGroup().addTo(this.tacticalMap);
  }

  async loadAlerts(isSilent = false) {
    try {
      this.alerts = await policeApi.getEmergencyAlerts();
      this.render();
      this.renderMapMarkers();
    } catch (e) {
      if (!isSilent) showPoliceToast('Failed to poll emergency queue: ' + e.message, 'danger');
    }
  }

  bindEvents() {
    // Tabs
    document.querySelectorAll('.sos-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sos-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'ACTIVE';
        this.render();
      });
    });

    // Sound toggle
    const soundToggle = document.getElementById('toggleAlertSoundBtn');
    if (soundToggle) {
      soundToggle.addEventListener('click', () => {
        this.audioAlertEnabled = !this.audioAlertEnabled;
        soundToggle.innerHTML = this.audioAlertEnabled ? '<span>🔊 Siren: ON</span>' : '<span>🔇 Siren: MUTED</span>';
        showPoliceToast(`Audio alert ${this.audioAlertEnabled ? 'enabled' : 'muted'}.`, 'info');
      });
    }

    // Manual Refresh
    const refreshBtn = document.getElementById('manualSosRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadAlerts();
        showPoliceToast('Distress queue refreshed.', 'info');
      });
    }
  }

  getFilteredAlerts() {
    return this.alerts.filter(a => {
      const s = (a.status || 'SENT').toUpperCase();
      if (this.activeFilter === 'ACTIVE') {
        return s === 'SENT' || s === 'ACTIVE' || s === 'PENDING' || s === 'ACKNOWLEDGED' || s === 'DISPATCHED';
      }
      if (this.activeFilter === 'RESOLVED') {
        return s === 'RESOLVED' || s === 'CANCELLED';
      }
      return true;
    });
  }

  render() {
    const container = document.getElementById('activeSosQueueContainer');
    if (!container) return;

    const filtered = this.getFilteredAlerts();
    const activeCount = this.alerts.filter(a => a.status === 'SENT' || a.status === 'ACTIVE' || a.status === 'PENDING').length;
    
    const countBadge = document.getElementById('sosActiveCounterBadge');
    if (countBadge) countBadge.textContent = `${activeCount} Live Distress Signals`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; background: var(--police-bg-panel); border-radius: var(--radius-md); border: 1px dashed var(--police-border); color: var(--police-text-muted);">
          <div style="font-size: 32px; color: var(--police-emerald); margin-bottom: 8px;">🛡️</div>
          <h4>Zero Active SOS Distress Signals</h4>
          <p style="font-size: 12.5px;">All emergency response queues are nominal and clear.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(alert => {
      const isUnacknowledged = alert.status === 'SENT' || alert.status === 'ACTIVE' || alert.status === 'PENDING';
      const timeAgo = this.formatTimeAgo(alert.createdAt);
      const locText = alert.location?.address || (alert.location?.latitude ? `${alert.location.latitude.toFixed(4)}, ${alert.location.longitude.toFixed(4)}` : 'GPS Position Transmitting');
      const navUrl = (alert.location?.latitude && alert.location?.longitude)
        ? `https://www.google.com/maps/dir/?api=1&destination=${alert.location.latitude},${alert.location.longitude}`
        : '#';

      return `
        <div class="police-panel" style="border-left: 4px solid ${isUnacknowledged ? 'var(--police-danger)' : 'var(--police-cyan)'}; margin-bottom: 1rem;">
          <div class="police-panel-header" style="background: rgba(239, 68, 68, ${isUnacknowledged ? '0.15' : '0.05'});">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">🚨</span>
              <strong style="color: #fff; font-family: var(--font-mono);">${this.escape(alert.alertReference || alert.id)}</strong>
              <span class="police-badge ${isUnacknowledged ? 'badge-priority-critical' : 'badge-under-investigation'}">${this.escape(alert.status || 'ACTIVE')}</span>
            </div>
            <div style="font-size: 12px; color: var(--police-text-secondary); font-family: var(--font-mono);">
              🕒 ${timeAgo}
            </div>
          </div>
          <div class="police-panel-body">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
              <div>
                <div style="margin-bottom: 0.75rem;">
                  <span style="font-size: 11px; text-transform: uppercase; color: var(--police-text-muted); font-weight: 600;">Victim / Caller:</span>
                  <div style="font-size: 13.5px; font-weight: 600; color: #fff;">${this.escape(alert.userEmail || alert.userUid || 'Registered Citizen')}</div>
                </div>

                <div style="margin-bottom: 0.75rem;">
                  <span style="font-size: 11px; text-transform: uppercase; color: var(--police-text-muted); font-weight: 600;">Exact Distress Location:</span>
                  <div style="font-size: 13px; color: var(--police-text-cyan); font-family: var(--font-mono);">📍 ${this.escape(locText)}</div>
                </div>

                <div>
                  <span style="font-size: 11px; text-transform: uppercase; color: var(--police-text-muted); font-weight: 600;">Dispatched Response Unit:</span>
                  <div style="font-size: 13px; color: #fff;">${this.escape(alert.assignedOfficer || alert.acknowledgedBy || 'None (Awaiting Officer Claim)')}</div>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; justify-content: center; gap: 0.65rem;">
                ${isUnacknowledged ? `
                  <button class="police-btn police-btn-danger ack-sos-btn" data-id="${this.escape(alert.id)}">
                    <span>⚡ Acknowledge & Claim Call</span>
                  </button>
                ` : `
                  <button class="police-btn police-btn-primary dispatch-unit-btn" data-id="${this.escape(alert.id)}">
                    <span>🚔 Dispatch Tactical Squad</span>
                  </button>
                  <button class="police-btn police-btn-secondary resolve-sos-btn" data-id="${this.escape(alert.id)}">
                    <span>✅ Mark Scene Secured / Safe</span>
                  </button>
                `}
                <a href="${navUrl}" target="_blank" rel="noopener" class="police-btn police-btn-secondary" style="font-size: 11.5px;">
                  <span>🗺️ Launch Road Navigation</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach Action Listeners
    container.querySelectorAll('.ack-sos-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Acknowledging...';
        const officer = policeAuth.getOfficer();
        try {
          await policeApi.acknowledgeEmergencyAlert(btn.dataset.id, officer);
          showPoliceToast('Distress call claimed under your service badge.', 'success');
          await this.loadAlerts();
        } catch (e) {
          showPoliceToast('Failed: ' + e.message, 'danger');
        }
      });
    });

    container.querySelectorAll('.dispatch-unit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const unit = prompt('Enter Tactical Unit / Squad Car Call Sign (e.g., PATROL-UNIT-4B):', 'PCR-SQUAD-12');
        if (!unit) return;
        const officer = policeAuth.getOfficer();
        try {
          await policeApi.updateEmergencyAlertStatus(btn.dataset.id, 'DISPATCHED', `Unit ${unit} dispatched to coordinates.`, officer);
          showPoliceToast(`Tactical unit ${unit} recorded en route.`, 'success');
          await this.loadAlerts();
        } catch (e) {
          showPoliceToast('Error: ' + e.message, 'danger');
        }
      });
    });

    container.querySelectorAll('.resolve-sos-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const debrief = prompt('Enter Incident Scene Debrief / Safety Closure Notes:', 'Victim reached safely by field officers. Situation stabilized.');
        if (!debrief) return;
        const officer = policeAuth.getOfficer();
        try {
          await policeApi.updateEmergencyAlertStatus(btn.dataset.id, 'RESOLVED', debrief, officer);
          showPoliceToast('Emergency distress alert closed and archived.', 'success');
          await this.loadAlerts();
        } catch (e) {
          showPoliceToast('Error: ' + e.message, 'danger');
        }
      });
    });
  }

  renderMapMarkers() {
    if (!this.tacticalMap || !this.tacticalMarkerGroup) return;
    this.tacticalMarkerGroup.clearLayers();

    const active = this.alerts.filter(a => a.status === 'SENT' || a.status === 'ACTIVE' || a.status === 'PENDING' || a.status === 'DISPATCHED');
    const bounds = [];

    active.forEach(a => {
      if (a.location?.latitude && a.location?.longitude) {
        const marker = L.circleMarker([a.location.latitude, a.location.longitude], {
          radius: 12,
          fillColor: '#EF4444',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(this.tacticalMarkerGroup);

        marker.bindPopup(`
          <div style="font-family: var(--font-main); color: #0F172A;">
            <strong style="color: #DC2626;">🚨 ACTIVE SOS: ${a.alertReference || a.id}</strong><br>
            <span>${a.location.address || 'Distress Point'}</span>
          </div>
        `);

        bounds.push([a.location.latitude, a.location.longitude]);
      }
    });

    if (bounds.length > 0) {
      this.tacticalMap.fitBounds(L.latLngBounds(bounds).pad(0.2));
    }
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'Just now';
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return `${elapsed}s ago`;
    if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
    return `${Math.floor(elapsed / 3600)}h ago`;
  }

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}
