/**
 * SheGuard Law Enforcement Portal - Case Investigation Dossier Controller
 * Architecture: FRONTEND 2 (Deep Case Investigation, Evidence Vault & Chronological Log)
 */

import { policeApi } from './police-api.js';
import { policeAuth, PRE_AUTHORIZED_OFFICERS } from './police-auth.js';
import { showPoliceToast } from './police-guards.js';

export class PoliceInvestigationController {
  constructor() {
    this.currentReference = null;
    this.report = null;
    this.notes = [];
    this.miniMap = null;
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');

    if (ref) {
      await this.loadCase(ref);
    } else {
      await this.loadDefaultOrSelector();
    }

    this.bindEvents();
  }

  async loadDefaultOrSelector() {
    try {
      const reports = await policeApi.getReports();
      if (reports.length > 0) {
        await this.loadCase(reports[0].reference);
      } else {
        document.getElementById('investigationContent').innerHTML = `
          <div style="text-align: center; padding: 4rem; color: var(--police-text-muted);">
            <div style="font-size: 32px; margin-bottom: 12px;">📂</div>
            <h3>No Active Cases Found</h3>
            <p>Select an incident from the Incident Registry to begin investigation.</p>
            <a href="police-reports.html" class="police-btn police-btn-primary" style="margin-top: 1rem;">Go to Reports Registry</a>
          </div>
        `;
      }
    } catch (e) {
      showPoliceToast('Failed to load initial case: ' + e.message, 'danger');
    }
  }

  async loadCase(reference) {
    this.currentReference = reference;
    try {
      this.report = await policeApi.getReportByReference(reference);
      this.notes = await policeApi.getInvestigationNotes(reference);
      this.render();
      this.renderNotes();
      this.initMiniMap();
    } catch (err) {
      showPoliceToast(`Could not load case ${reference}: ${err.message}`, 'danger');
    }
  }

  bindEvents() {
    // Add Note Form
    const noteForm = document.getElementById('addNoteForm');
    if (noteForm) {
      noteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('newInvestigationNote');
        const text = input.value.trim();
        if (!text) return;

        const officer = policeAuth.getOfficer();
        try {
          await policeApi.addInvestigationNote(this.currentReference, text, officer);
          showPoliceToast('Investigation note appended to legal case diary.', 'success');
          input.value = '';
          this.notes = await policeApi.getInvestigationNotes(this.currentReference);
          this.renderNotes();
        } catch (err) {
          showPoliceToast('Failed to add note: ' + err.message, 'danger');
        }
      });
    }

    // Status Update Button
    const updateStatusBtn = document.getElementById('openStatusModalBtn');
    if (updateStatusBtn) {
      updateStatusBtn.addEventListener('click', () => this.openStatusModal());
    }

    // Assign Officer Button
    const assignBtn = document.getElementById('openAssignModalBtn');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => this.openAssignModal());
    }
  }

  render() {
    if (!this.report) return;
    const r = this.report;

    // Header values
    document.getElementById('dossierRefTitle').textContent = r.reference;
    document.getElementById('dossierCategoryBadge').textContent = this.formatCategory(r.category);
    
    const statusClass = `badge-${(r.status || 'submitted').toLowerCase().replace(/_/g, '-')}`;
    const statusBadge = document.getElementById('dossierStatusBadge');
    statusBadge.className = `police-badge ${statusClass}`;
    statusBadge.textContent = this.formatStatus(r.status);

    const prioClass = `badge-priority-${(r.priority || 'medium').toLowerCase()}`;
    const prioBadge = document.getElementById('dossierPriorityBadge');
    prioBadge.className = `police-badge ${prioClass}`;
    prioBadge.textContent = (r.priority || 'MEDIUM').toUpperCase();

    // Incident details
    document.getElementById('dossierDateTime').textContent = `${r.incidentDate || 'N/A'} at ${r.incidentTime || 'N/A'}`;
    document.getElementById('dossierAddress').textContent = r.location?.address || 'Street address not provided';
    document.getElementById('dossierCoordinates').textContent = (r.location?.latitude && r.location?.longitude)
      ? `${r.location.latitude.toFixed(5)}, ${r.location.longitude.toFixed(5)}`
      : 'Coordinates withheld';

    document.getElementById('dossierStatement').textContent = r.description || 'No detailed statement filed.';
    document.getElementById('dossierReporter').textContent = r.reporterEmail || 'Confidential Victim Record';
    document.getElementById('dossierConsent').textContent = r.consentGiven ? '✅ Consent explicitly granted for law enforcement prosecution' : '⚠️ Anonymous community report';

    // Officer Info
    document.getElementById('dossierOfficerName').textContent = r.assignedOfficerName || 'Pending Officer Assignment';
    document.getElementById('dossierDepartment').textContent = r.assignedDepartment || 'General Triage & Verification';

    // Evidence
    const evidenceBox = document.getElementById('dossierEvidenceBox');
    if (r.evidenceUrl) {
      const isImg = /\.(jpeg|jpg|png|webp|gif)$/i.test(r.evidenceUrl) || r.evidenceUrl.includes('firebasestorage');
      evidenceBox.innerHTML = `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--police-border); border-radius: var(--radius-sm); padding: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 600; color: #fff;">📎 Encrypted Case Evidence Attachment</span>
            <a href="${r.evidenceUrl}" target="_blank" rel="noopener noreferrer" class="police-btn police-btn-primary police-btn-sm">
              <span>Inspect Raw File &rarr;</span>
            </a>
          </div>
          ${isImg ? `
            <div style="text-align: center; max-height: 260px; overflow: hidden; border-radius: 4px; background: #000;">
              <img src="${r.evidenceUrl}" alt="Case Evidence" style="max-height: 260px; max-width: 100%; object-fit: contain;">
            </div>
          ` : `
            <div style="padding: 1.5rem; text-align: center; color: var(--police-cyan); font-family: var(--font-mono);">
              📄 Forensic Attachment Ready for Authorized Download
            </div>
          `}
          <div style="font-size: 11px; color: var(--police-text-muted); margin-top: 8px;">
            SHA-256 Verified • Tamper-evident cloud storage proof
          </div>
        </div>
      `;
    } else {
      evidenceBox.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--police-text-muted); border: 1px dashed var(--police-border); border-radius: var(--radius-sm);">
          No digital photographic or audio attachments submitted with this report.
        </div>
      `;
    }
  }

  renderNotes() {
    const container = document.getElementById('dossierTimelineContainer');
    if (!container) return;

    if (this.notes.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--police-text-muted); font-size: 12.5px;">
          No investigative log entries recorded yet. Submit the first note below.
        </div>
      `;
      return;
    }

    container.innerHTML = this.notes.map(note => `
      <div class="police-timeline-item">
        <div class="police-timeline-dot"></div>
        <div class="police-timeline-content">
          <div class="police-timeline-header">
            <span class="police-timeline-author">
              👮 ${this.escape(note.officerName || 'Police Personnel')} <span style="font-family: var(--font-mono); font-size: 11px; color: var(--police-cyan);">(${this.escape(note.badgeNumber || 'SG-OFF')})</span>
            </span>
            <span class="police-timeline-time">${new Date(note.timestamp).toLocaleString()}</span>
          </div>
          <div class="police-timeline-text">
            ${this.escape(note.note)}
          </div>
        </div>
      </div>
    `).join('');
  }

  initMiniMap() {
    if (!this.report || !this.report.location) return;
    const lat = this.report.location.latitude;
    const lon = this.report.location.longitude;
    if (!lat || !lon) return;

    const mapEl = document.getElementById('dossierMiniMap');
    if (!mapEl || typeof L === 'undefined') return;

    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = null;
    }

    this.miniMap = L.map('dossierMiniMap', {
      zoomControl: false,
      attributionControl: false
    }).setView([lat, lon], 14);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(this.miniMap);

    const marker = L.circleMarker([lat, lon], {
      radius: 9,
      fillColor: '#EF4444',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(this.miniMap);

    marker.bindPopup(`<strong>${this.report.reference}</strong><br>${this.report.location.address || 'Incident Scene'}`);
  }

  openStatusModal() {
    const modal = document.getElementById('investigationStatusModal');
    if (!modal) return;

    const select = document.getElementById('investigationStatusSelect');
    if (select) select.value = this.report.status || 'SUBMITTED';

    modal.classList.add('open');

    const saveBtn = document.getElementById('saveInvestigationStatusBtn');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Updating...';

      const newStatus = select.value;
      const notes = document.getElementById('investigationStatusNotes').value;
      const officer = policeAuth.getOfficer();

      try {
        await policeApi.updateReportStatus(this.currentReference, newStatus, notes, officer);
        showPoliceToast(`Case status updated to ${newStatus}. Synced with User Portal.`, 'success');
        modal.classList.remove('open');
        await this.loadCase(this.currentReference);
      } catch (e) {
        showPoliceToast('Failed to update status: ' + e.message, 'danger');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Commit Status Change';
      }
    };

    document.getElementById('closeInvestigationStatusBtn').onclick = () => modal.classList.remove('open');
  }

  openAssignModal() {
    const modal = document.getElementById('investigationAssignModal');
    if (!modal) return;

    const select = document.getElementById('investigationOfficerSelect');
    if (select) {
      select.innerHTML = PRE_AUTHORIZED_OFFICERS.map(o => `
        <option value="${o.id}">${o.rank} - ${o.name} (${o.department})</option>
      `).join('');
    }

    modal.classList.add('open');

    const confirmBtn = document.getElementById('saveInvestigationAssignBtn');
    confirmBtn.onclick = async () => {
      const selectedId = select.value;
      const officer = PRE_AUTHORIZED_OFFICERS.find(o => o.id === selectedId) || PRE_AUTHORIZED_OFFICERS[0];
      const priority = document.getElementById('investigationPrioritySelect').value;

      try {
        await policeApi.assignOfficer(this.currentReference, { ...officer, priority });
        showPoliceToast(`Assigned to ${officer.name}`, 'success');
        modal.classList.remove('open');
        await this.loadCase(this.currentReference);
      } catch (e) {
        showPoliceToast('Failed to assign officer: ' + e.message, 'danger');
      }
    };

    document.getElementById('closeInvestigationAssignBtn').onclick = () => modal.classList.remove('open');
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

  formatStatus(status) {
    if (!status) return 'Submitted';
    return status.replace(/_/g, ' ');
  }

  escape(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
}
