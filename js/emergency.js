/**
 * SheGuard - SOS Emergency Alert Controller
 * Countdown handling, real GPS acquisition, alert dispatch, and provider delivery status tracking.
 */
import { api } from './api.js';
import { locationService } from './location.js';
import { contactsService } from './contacts.js';
import { showToast, escapeHtml } from './ui.js';

export class EmergencyController {
  constructor() {
    this.countdownSeconds = 5;
    this.countdownTimer = null;
    this.isDispatching = false;
    this.currentPosition = null;
    this.trustedContacts = [];
  }

  /**
   * Initializes emergency screen data
   */
  async init() {
    // 1. Fetch current GPS position preview
    try {
      this.currentPosition = await locationService.getCurrentPosition();
      const posPreview = document.getElementById('sosLocationPreview');
      if (posPreview) {
        posPreview.innerHTML = `
          <strong>Coordinates:</strong> ${this.currentPosition.latitude.toFixed(5)}, ${this.currentPosition.longitude.toFixed(5)}<br>
          <span style="font-size: 11px; color: #94A3B8;">Accuracy: &plusmn;${this.currentPosition.accuracy}m</span>
        `;
      }
    } catch (err) {
      const posPreview = document.getElementById('sosLocationPreview');
      if (posPreview) {
        posPreview.innerHTML = `<span style="color: #F87171;">Location permission denied or unavailable: ${escapeHtml(err.message)}</span>`;
      }
    }

    // 2. Fetch trusted contacts
    try {
      this.trustedContacts = await contactsService.getContacts();
      const contactsList = document.getElementById('sosContactsList');
      if (contactsList) {
        if (!this.trustedContacts || this.trustedContacts.length === 0) {
          contactsList.innerHTML = `
            <div style="font-size: 12px; color: #94A3B8;">
              No trusted contacts added yet. <a href="trusted-contacts.html" style="color: #38BDF8;">Add emergency contacts</a> to receive instant SMS/Email alerts.
            </div>
          `;
        } else {
          contactsList.innerHTML = this.trustedContacts.map(c => `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05);">
              <span>${escapeHtml(c.name)} (${escapeHtml(c.relationship || 'Contact')})</span>
              <span style="color: #94A3B8; font-family: monospace;">${escapeHtml(c.phoneNumber || c.email)}</span>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('[SOS] Could not load trusted contacts:', err.message);
    }

    // 3. Load past alerts
    this.loadPastAlerts();
  }

  /**
   * Starts the 5-second cancelable SOS countdown
   */
  startCountdown(onTick, onComplete, onCancel) {
    if (this.isDispatching) return;

    let remaining = this.countdownSeconds;
    onTick(remaining);

    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        onTick(remaining);
      } else {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        onComplete();
      }
    }, 1000);
  }

  /**
   * Cancels the active countdown
   */
  cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      return true;
    }
    return false;
  }

  /**
   * Dispatches genuine SOS alert to backend
   */
  async dispatchAlert(customMessage = '') {
    if (this.isDispatching) return;
    this.isDispatching = true;

    // Refresh location if available
    let locationPayload = null;
    try {
      const pos = await locationService.getCurrentPosition();
      this.currentPosition = pos;
      locationPayload = {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy
      };
    } catch (err) {
      console.warn('[SOS] Location not included in alert:', err.message);
    }

    const payload = {
      type: 'SOS_EMERGENCY',
      message: customMessage || 'EMERGENCY SOS: I need immediate help. Please check my coordinates.',
      location: locationPayload
    };

    try {
      const alertResponse = await api.post('/emergency/alerts', payload);
      this.isDispatching = false;
      return alertResponse;
    } catch (err) {
      this.isDispatching = false;
      throw err;
    }
  }

  /**
   * Loads user's historical emergency alerts with provider delivery status
   */
  async loadPastAlerts() {
    const listEl = document.getElementById('sosHistoryList');
    if (!listEl) return;

    try {
      const alerts = await api.get('/emergency/alerts');
      if (!alerts || alerts.length === 0) {
        listEl.innerHTML = `<p style="font-size: 12px; color: #94A3B8; text-align: center;">No prior emergency alerts triggered.</p>`;
        return;
      }

      listEl.innerHTML = alerts.map(a => {
        const statusColor = a.status === 'DELIVERED' ? '#10B981' : (a.status === 'FAILED' ? '#EF4444' : '#F59E0B');
        return `
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: #EF4444; font-size: 13px;">🚨 ${escapeHtml(a.type || 'SOS Alert')}</strong>
              <span style="font-size: 11px; padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.05); color: ${statusColor}; font-weight: bold; border: 1px solid ${statusColor};">
                ${escapeHtml(a.status || 'PENDING')}
              </span>
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">
              Ref: <span style="font-family: monospace;">${escapeHtml(a.alertReference || 'N/A')}</span> &bull; 
              ${new Date(a.createdAt || Date.now()).toLocaleString()}
            </div>
            <p style="font-size: 12px; color: #E2E8F0; margin: 4px 0;">${escapeHtml(a.message || '')}</p>
            ${a.providerStatusSummary ? `
              <div style="font-size: 11px; color: #94A3B8; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 4px;">
                <strong>Provider Log:</strong> ${escapeHtml(a.providerStatusSummary)}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-warning" style="font-size: 11px;">Could not fetch alert history: ${escapeHtml(err.message)}</div>`;
    }
  }
}

export const emergencyController = new EmergencyController();
